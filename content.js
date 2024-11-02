// contentScript.js
console.log('Content script loaded on', window.location.href);

const ImageCensor = (() => {
    const defaultState = {
        censorEnabled: true,
        blurIntensity: 40
    };
    const classNameMap = {
        'Drawing': 'Drawing',
        'Hentai': 'Hentai',
        'Neutral': 'Neutral',
        'Porn': 'Porn',
        'Sexy': 'Sexy'
    };
    const loadSettings = () =>
        new Promise(resolve =>
            chrome.storage.local.get(["censorEnabled", "blurIntensity", "revealedImages"], result =>
                resolve({
                    censorEnabled: result.censorEnabled !== false,
                    blurIntensity: result.blurIntensity || defaultState.blurIntensity,
                    revealedImages: result.revealedImages || {}
                })
            )
        );

    const getBaseUrl = (url) => {
        try {
            // Check for common invalid URL patterns
            if (!url || url.startsWith('--') || url.startsWith('chrome-extension://')) {
                return null; // Or return a default value
            }
            if (url.startsWith('data:')) {
                return url;
            }
            const urlObj = new URL(url);
            return urlObj.origin + urlObj.pathname;
        } catch (error) {
            console.error('Invalid URL:', url, error);
            return null; // Or return a default value
        }
    };
    
    const blurElement = state => element => {
        const imageUrl = element.tagName === 'IMG' ? element.src || element.srcset.split(' ')[0] : element.style.backgroundImage.slice(4, -1).replace(/"/g, "");
        // console.log("blurElement called with imageUrl:", imageUrl);
        // Check if imageUrl is a valid URL
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
            return element; // Skip processing if not a valid URL
        }

        const baseUrl = getBaseUrl(imageUrl);
        if (!state.censorEnabled || element.dataset.censored) return element;
        console.log("blurElement called with baseUrl:", baseUrl);
        // // Check if the element has a background image and is large enough
        const isLargeEnough = element.offsetWidth >= 60 || element.offsetHeight >= 60;
        if (!imageUrl || !isLargeEnough) return element;

        // // Check if the element already has a blur filter with 40px and !important
        const currentFilter = element.style.getPropertyValue('filter');
        if (currentFilter && currentFilter.includes(`blur(${state.blurIntensity}px)`) && currentFilter.includes('!important')) {
            return element; // Skip blurring if the element already has the desired blur filter
        }

        element.dataset.censored = "true";
        element.classList.add("censored-image"); // Add a unique class to the element
        element.style.setProperty("filter", `blur(${state.blurIntensity}px)`, "important");

        return element;
    };

    const censorAllImages = state => {
        const images = Array.from(document.querySelectorAll("img", "div[style*='background-image']"));
        images.forEach(element => {
            blurElement(state)(element)
            // Start scanning images when the content script runs
            setTimeout(() => {
                scanImages(element, state);
            }, 100);
            // checkNSFWContent(state, model, [element]);
        });
    };
    const updateRevealedImages = state =>
        new Promise(resolve =>
            chrome.storage.local.set({
                revealedImages: state.revealedImages
            }, () => resolve(state))
    );
    const removeAllCensors = () => {
        const elements = Array.from(document.querySelectorAll("[data-censored]"));
        elements.forEach(element => {
            element.style.filter = "none";
            delete element.dataset.censored;
        });
        //also remove all label with class bestie-nsfw-label
        const labels = Array.from(document.querySelectorAll(".bestie-nsfw-label"));
        labels.forEach(label => {
            label.remove()
        });

    };
    const observeNewImages = (state) => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' ) {
                    const target = mutation.target;
                    if (
                        (mutation.attributeName === 'src' && target.tagName === 'IMG') ||
                        (mutation.attributeName === 'style' && target.style.backgroundImage)
                    ) {
                        blurElement(state)(target);
                        setTimeout(() => {
                            scanImages(target, state);
                        }, 100);
                    }
                }
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'IMG' || node.tagName === 'DIV') {
                                blurElement(state)(node);
                                setTimeout(() => {
                                    scanImages(node, state);
                                }, 100);
                            }
                            const images = node.querySelectorAll('img, div[style*="background-image"]');
                            images.forEach((img) => {
                                blurElement(state)(img);
                                setTimeout(() => {
                                    scanImages(img, state);
                                }, 100);
                            });
                        }
                    });
                }
            });
        });

        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'srcset', 'style'],
            });
        } else {
            console.warn('Document body not found. Retrying in 100ms...');
            setTimeout(() => observeNewImages(state), 100);
        }

        return observer;
    };
    
    const updateEnabledState = newState =>
        new Promise(resolve =>
            chrome.storage.local.set({
                censorEnabled: newState.censorEnabled,
                blurIntensity: newState.blurIntensity
            }, () => resolve(newState))
        );

    const uncensorImage = (state, imageUrl) => {
        const elements = Array.from(document.querySelectorAll(`img[src="${imageUrl}"][data-censored], div[data-censored]`));
        
        elements.forEach(el => {
            if (el.tagName === 'IMG' && el.src === imageUrl) {
                el.style.filter = "none";
                delete el.dataset.censored;
            } else if (el.tagName === 'DIV') {
                const backgroundImage = el.style.backgroundImage;
                if (backgroundImage.includes(`url("${imageUrl}")`) || backgroundImage.includes(`url('${imageUrl}')`)) {
                    el.style.filter = "none";
                    delete el.dataset.censored;
                }
            }
        });
        const baseUrl = getBaseUrl(imageUrl);
        state.revealedImages[baseUrl] = true;
        updateRevealedImages(state);
    };
        

    const setupMessageListener = state => {
        chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
            console.log('Message received in content script:', message);
            if (message.action === 'enableCensor') {
                const newState = {
                    ...state,
                    censorEnabled: true
                };
                updateEnabledState(newState).then(() => censorAllImages(newState));
            } else if (message.action === 'disableCensor') {
                const newState = {
                    ...state,
                    censorEnabled: false,
                    revealedImages: {} // Clear revealed images
                };
                updateEnabledState(newState).then(() => {
                    removeAllCensors(newState); // Remove censor from all images
                });
            } else if (message.action === "revealImage") {
                uncensorImage(state, message.srcUrl);
            }
        });
    };

    function getHighestProbabilityClass(probabilities) {
        return Object.entries(probabilities).reduce((maxClass, [className, probability]) => {
            if (probability > maxClass.probability) {
                return { className, probability };
            }
            return maxClass;
        }, { className: null, probability: 0 });
    }
    
    function createLabel(className, probability, originalClassName = null) {
        const label = document.createElement('div');
        label.classList.add('bestie-label', `bestie-${className.toLowerCase()}-label`);
        
        if (originalClassName) {
            label.textContent = `Unrecognized (${classNameMap[originalClassName]}: ${(probability * 100).toFixed(2)}%)`;
        } else {
            label.textContent = `${classNameMap[className]} (${(probability * 100).toFixed(2)}%)`;
        }
        
        label.style.position = 'absolute';
        label.style.top = '0';
        label.style.left = '0';
        label.style.color = 'white';
        label.style.padding = '4px';
        label.style.fontSize = '14px';
        label.style.fontWeight = 'bold';
        label.style.zIndex = '100';
        label.style.isolation = 'isolate';
    
        if (className === 'Neutral') {
            label.style.backgroundColor = 'rgba(0, 255, 0, 0.7)';
            label.style.color = 'black';
        } else if (className === 'Unrecognized') {
            label.style.backgroundColor = 'rgba(255, 165, 0, 0.7)';
        } else {
            label.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        }
        
        return label;
    }
    
    function removeExistingLabels(parentElement) {
        const existingLabels = parentElement.querySelectorAll('.bestie-label');
        existingLabels.forEach(label => label.remove());
    }
    
    function appendLabels(parentElement, labels) {
        if (parentElement && window.getComputedStyle(parentElement).position === "static") {
            parentElement.style.position = "relative";
        }
    
        labels.forEach(label => parentElement.appendChild(label));
    }
    
    // Function to scan images on the page
    function scanImages(img, state) {
        if (img.complete && img.naturalHeight !== 0) {
            const imageUrl = img.src || img.srcset.split(' ')[0];
            analyzeImage(img, state, imageUrl);
        } 
    }
    // Function to request image analysis
    function analyzeImage(img, state, imageUrl) {
        const isLargeEnough = img.offsetWidth >= 60 || img.offsetHeight >= 60;
        if (!isLargeEnough) return img;
        if (state.censorEnabled) {
            // Send message to background script to analyze the image
            chrome.runtime.sendMessage({ type: 'ANALYZE_IMAGE', imageUrl: imageUrl }, (response) => {
                    if (response.type === 'ANALYSIS_RESULT') {
                        handleAnalysisResult(img, response.result, state);
                    } else if (response.type === 'ANALYSIS_ERROR') {
                        console.error('Analysis error:', response.error);
                    }
                }
            );
        }
    }

    // Function to handle the analysis result
    function handleAnalysisResult(element, result, state) {
        const probabilities = result.reduce((acc, pred) => {
            acc[pred.className] = pred.probability;
            return acc;
        }, {});
    
        const highestProbabilityClass = getHighestProbabilityClass(probabilities);
        const labels = [];
    
        if (highestProbabilityClass.probability > 0.6) {
            const { className, probability } = highestProbabilityClass;
            const label = createLabel(className, probability);
            labels.push(label);
        } else {
            const { className, probability } = highestProbabilityClass;
            const label = createLabel('Unrecognized', probability, className);
            labels.push(label);
        }
    
        const parentElement = element.parentElement;
        removeExistingLabels(parentElement);
        appendLabels(parentElement, labels);
    
        if (probabilities['Neutral'] > 0.8) {
            // uncensorImage(state, element.src);
        }
    }
    
    

    const init = async () => {
        try {
            const state = await loadSettings();
            setupMessageListener(state);
            censorAllImages(state);// instantly censor all images
            observeNewImages(state);// gradually censor new images
        } catch (error) {
            console.error('Error loading NSFWJS:', error);
        }
    };

    return {
        init
    };
})();

ImageCensor.init();


