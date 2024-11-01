// contentScript.js
console.log('Content script loaded on', window.location.href);

const ImageCensor = (() => {
    const defaultState = {
        censorEnabled: true,
        blurIntensity: 40
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
        const imageUrl = element.tagName === 'IMG' ? element.src : element.style.backgroundImage.slice(4, -1).replace(/"/g, "");
        if (element.style.backgroundImage) console.log("imageUrl :", imageUrl)
        // Check if imageUrl is a valid URL
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
            return element; // Skip processing if not a valid URL
        }
    
        const baseUrl = getBaseUrl(imageUrl);
        if (!state.censorEnabled || element.dataset.censored || state.revealedImages[baseUrl]) return element;
    
        // Check if the element has a background image and is large enough
        const isLargeEnough = element.offsetWidth >= 128 || element.offsetHeight >= 128;
        if (!imageUrl || !isLargeEnough) return element;
    
        // Check if the element already has a blur filter with 40px and !important
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
        console.log("images :", images)
        images.forEach(element => {
            blurElement(state)(element)
            // Start scanning images when the content script runs
            scanImages(element, state);
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
                // Handle added nodes (new elements added to the DOM)
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // If the added node is an image
                            if (node.tagName === 'IMG') {
                                blurElement(state)(node);
                                scanImages(node, state);
                            }
                            // If the added node has a background image
                            if (node.style && node.style.backgroundImage) {
                                blurElement(state)(node);
                                scanImages(node, state);
                            }
                            // Check for images within the added node
                            const images = node.querySelectorAll('img, div[style*="background-image"]');
                            images.forEach((img) => {
                                blurElement(state)(img);
                                scanImages(img, state);
                            });
                        }
                    });
                }
                // Handle attribute changes (e.g., changes to the 'src' attribute of images)
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    if (mutation.attributeName === 'src' && target.tagName === 'IMG') {
                        blurElement(state)(target);
                        scanImages(target, state);
                    }
                    if (mutation.attributeName === 'style' && target.style.backgroundImage) {
                        blurElement(state)(target);
                        scanImages(target, state);
                    }
                }
            });
        });
    
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'style'],
        });
    
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
        const image = Array.from(document.querySelectorAll(`img[src="${imageUrl}"][data-censored], div[data-censored]`)).find(el => {
            if (el.tagName === 'IMG') {
                return el; // Return the element if it's an img
            }
            const backgroundImage = el.style.backgroundImage;
            return backgroundImage.includes(`url("${imageUrl}")`) || backgroundImage.includes(`url('${imageUrl}')`);
        });

        if (image) {
            const baseUrl = getBaseUrl(imageUrl);
            image.style.filter = "none";
            state.revealedImages[baseUrl] = true;
            updateRevealedImages(state);
            delete image.dataset.censored;
        }
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

    const addNSFWLabel = (element, probability) => {
        const label = document.createElement('div');
        // add specific class to the label
        label.classList.add('bestie-nsfw-label');
        label.textContent = `NSFW (${(probability * 100).toFixed(2)}%)`;
        label.style.position = 'absolute';
        label.style.top = '0';
        label.style.left = '0';
        label.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        label.style.color = 'white';
        label.style.padding = '4px';
        label.style.fontSize = '14px';
        label.style.fontWeight = 'bold';
        label.style.zIndex = '1000';    
        label.style.isolation = 'isolate'; // Add isolation property


        const parentElement = element.parentElement;
        if (parentElement && window.getComputedStyle(parentElement).position === "static") {
            parentElement.style.position = "relative";
        }

        parentElement.appendChild(label);
    };

    // Function to scan images on the page
    function scanImages(img, state) {
        if (img.complete && img.naturalHeight !== 0) {
            analyzeImage(img, state);
        } 
    }

    // Function to request image analysis
    function analyzeImage(img, state) {
        const imageUrl = img.src;
        const isLargeEnough = img.offsetWidth >= 128 || img.offsetHeight >= 128;
        if (!isLargeEnough) return img;
        blurElement(state)(img);
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

    // Function to handle the analysis result
    function handleAnalysisResult(img, result, state) {
        // Check if the image is classified as NSFW
        
        const nsfwProbability = result.find(
            (pred) => pred.className === 'Porn' || pred.className === 'Hentai'
        )?.probability;
        const sfwProbability = result.find(
            (pred) => pred.className === 'Neutral'
        )?.probability;
        // Add NSFW label if the probability is above the threshold
        
        if (nsfwProbability > 0.7) {
            // addNSFWLabel(img, nsfwProbability);
        } 
        addNSFWLabel(img, nsfwProbability);
        if (sfwProbability > 0.9){
            // uncensorImage(state, img.src);
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


