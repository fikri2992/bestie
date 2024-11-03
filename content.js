// content.js
if (window !== window.top) {
    console.log('Content script not in top frame. Exiting.');
} else {
    console.log('Content script loaded on', window.location.href);
    
    const ImageCensor = (() => {
    
        let observersEnabled = false;
        let mutationObserver = null;
        let intersectionObserver = null;
    
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
                chrome.storage.local.get(["censorEnabled", "blurIntensity", "revealedImages", "allowlist", "badWords"], result =>
                    resolve({
                        censorEnabled: result.censorEnabled !== false,
                        blurIntensity: result.blurIntensity || defaultState.blurIntensity,
                        revealedImages: result.revealedImages || {},
                        allowlist: result.allowlist || [],
                        badWords: result.badWords || []
                    })
                )
            );
    
        const getFullUrl = (url) => {
            try {
                if (!url || url.startsWith('--') || url.startsWith('chrome-extension://')) {
                    return null;
                }
                if (url.startsWith('data:')) {
                    return url;
                }
                return url;
            } catch (error) {
                console.error('Invalid URL:', url, error);
                return null;
            }
        };
    
        const blurElement = state => element => {
            let imageUrl = '';
    
            if (element.tagName === 'IMG') {
                if (element.srcset) {
                    const srcset = element.srcset.split(',');
                    const sizes = element.sizes.split(',');
                    const windowWidth = window.innerWidth;
    
                    let maxWidth = 0;
                    let maxWidthUrl = '';
    
                    srcset.forEach((src, index) => {
                        const [url, width] = src.trim().split(' ');
                        const widthValue = parseInt(width);
    
                        if (widthValue > maxWidth && widthValue <= windowWidth) {
                            maxWidth = widthValue;
                            maxWidthUrl = url;
                        }
                    });
    
                    imageUrl = maxWidthUrl || element.src;
                } else {
                    imageUrl = element.src;
                }
            } else if (element.tagName === 'DIV') {
                const backgroundImage = element.style.backgroundImage;
                if (backgroundImage && backgroundImage.startsWith('url("')) {
                    imageUrl = backgroundImage.slice(5, -2); // Extract URL from url("...")
                }
            }
    
            // Check if the imageUrl matches the desired URL
            if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
                return element;
            }
    
            const FullUrl = getFullUrl(imageUrl);
    
            if (!state.censorEnabled) {
                return element;
            }
    
            if (state.revealedImages[FullUrl]) {
                return element;
            }
    
            if (element.dataset.censored) {
                return element;
            }
    
            const isLargeEnough = element.offsetWidth >= 60 || element.offsetHeight >= 60;
    
            if (!imageUrl || !isLargeEnough) {
                return element;
            }
    
            const currentFilter = element.style.getPropertyValue('filter');
    
            if (currentFilter && currentFilter.includes(`blur(${state.blurIntensity}px)`) && currentFilter.includes('!important')) {
                return element;
            }
    
            element.dataset.censored = "true";
            element.classList.add("censored-image");
            element.style.setProperty("filter", `blur(${state.blurIntensity}px)`, "important");
    
            return element;
        };
    
    
        const censorAllImages = state => {
            const images = Array.from(document.querySelectorAll("img, div[style*='background-image']"));
            images.forEach(element => {
                blurElement(state)(element);
                setTimeout(() => {
                    scanImages(element, state);
                }, 100);
            });
        };
    
        const updateRevealedImages = state =>
            new Promise(resolve =>
                chrome.storage.local.set({
                    revealedImages: state.revealedImages
                }, () => resolve(state))
            );
    
        const removeAllCensors = (state) => {
            const elements = Array.from(document.querySelectorAll("[data-censored], .bestie-label"));
            elements.forEach(element => {
                let imageUrl = '';
                if (element.tagName === 'IMG') {
                    imageUrl = element.src;
                } else if (element.tagName === 'DIV') {
                    const backgroundImage = element.style.backgroundImage;
                    if (backgroundImage && backgroundImage.startsWith('url("')) {
                        imageUrl = backgroundImage.slice(5, -2); // Extract URL from url("...")
                    }
                }
    
                if (element.hasAttribute("data-censored")) {
                    if (element.tagName === 'IMG') {
                        element.style.filter = "none";
                    } else if (element.tagName === 'DIV') {
                        element.style.removeProperty('filter');
                    }
                    element.classList.remove("censored-image");
                    delete element.dataset.censored;
                } else {
                    element.remove();
                }
            });
        };
    
    
        const uncensorImage = (state, imageUrl) => {
            const FullUrl = getFullUrl(imageUrl);
            state.revealedImages[FullUrl] = true; // Store based on FullUrl
    
            const elements = Array.from(document.querySelectorAll(`img[src*="${FullUrl}"][data-censored], div[data-censored]`)); // Select elements with FullUrl in src
            elements.forEach(el => {
                const elFullUrl = getFullUrl(el.tagName === 'IMG' ? el.src : el.style.backgroundImage.slice(4, -1).replace(/"/g, ""));
                if (elFullUrl && elFullUrl.includes(FullUrl)) { // Check if element's FullUrl matches the revealed FullUrl
                    el.style.filter = "none";
                    el.classList.remove("censored-image");
                    delete el.dataset.censored;
                }
            });
        };
    
        const uncensorWithRevealImage = (state, imageUrl) => {
            const FullUrl = getFullUrl(imageUrl);
            state.revealedImages[FullUrl] = true; // Store based on FullUrl
            const elements = Array.from(document.querySelectorAll(`img[src*="${FullUrl}"][data-censored], div[data-censored]`)); // Select elements with FullUrl in src
    
            elements.forEach(el => {
                const elFullUrl = getFullUrl(el.tagName === 'IMG' ? el.src : el.style.backgroundImage.slice(4, -1).replace(/"/g, ""));
                if (elFullUrl && elFullUrl.includes(FullUrl)) { // Check if element's FullUrl matches the revealed FullUrl
                    el.style.filter = "none";
                    el.classList.remove("censored-image");
                    delete el.dataset.censored;
                    //delete label also
                }
            });
    
            updateRevealedImages(state);
        };
    
        const observeNewImages = (state) => {
            if (observersEnabled) {
                return;
            }
    
            mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes') {
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
                        handleNewImages(mutation.addedNodes);
                    }
                });
            });
    
            // Intersection Observer for lazy-loaded images
            intersectionObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        blurElement(state)(img);
                        setTimeout(() => {
                            scanImages(img, state);
                        }, 100);
                        observer.unobserve(img); // Stop observing once blurred
                    }
                });
            });
    
            const handleNewImages = (addedNodes) => {
                addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'IMG' || node.tagName === 'DIV') {
                            if (node.tagName === 'IMG' && node.complete) {
                                blurElement(state)(node);
                                scanImages(node, state);
                            } else {
                                intersectionObserver.observe(node); // Observe for intersection (lazy loading)
                            }
                        }
                        const images = node.querySelectorAll('img, div[style*="background-image"]');
                        images.forEach((img) => {
                            if (img.tagName === 'IMG' && img.complete) {
                                blurElement(state)(img);
                                scanImages(img, state);
                            } else {
                                intersectionObserver.observe(img);
                            }
                        });
                    }
                });
            }
    
            if (document.body) {
                mutationObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['src', 'srcset', 'style'],
                });
                observersEnabled = true;
            } else {
                setTimeout(() => observeNewImages(state), 100);
            }
        };
    
        const disableObservers = () => {
            if (mutationObserver) {
                mutationObserver.disconnect();
                mutationObserver = null;
            }
            if (intersectionObserver) {
                intersectionObserver.disconnect();
                intersectionObserver = null;
            }
            observersEnabled = false;
        };
    
        const updateEnabledState = newState =>
            new Promise(resolve =>
                chrome.storage.local.set({
                    censorEnabled: newState.censorEnabled,
                    blurIntensity: newState.blurIntensity
                }, () => resolve(newState))
            );
        const setupMessageListener = state => {
            chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
                if (message.action === 'enableCensor') {
                    const newState = {
                        ...state,
                        censorEnabled: true
                    };
                    updateEnabledState(newState).then(() => {
                        censorAllImages(newState);
                        observeNewImages(newState); // Enable observers when censoring is enabled
                    });
                } else if (message.action === 'disableCensor') {
                    const newState = {
                        ...state,
                        censorEnabled: false,
                    };
                    updateEnabledState(newState).then(() => {
                        removeAllCensors(newState); // Remove censor from all images
                        disableObservers(); // Disable observers when censoring is disabled
                    });
                } else if (message.action === "revealImage") {
                    uncensorWithRevealImage(state, message.srcUrl);
                } else if (message.action === "askBestieAboutImage") {
                    console.log("Asking Bestie about image:", message.srcUrl);
                    askBestieAboutImage(state, message.srcUrl);
                } else if (message.action === 'askBestieAboutText') {
                    const selectedText = message.selectedText;
                    chrome.runtime.sendMessage({
                        action: 'captureScreenshotWithText',
                        selectedText: selectedText
                    }, response => {
                        if (response.success) {
                            console.log('Screenshot and text sent successfully');
                        } else {
                            console.error('Failed to send screenshot and text');
                        }
                    });
                }
            });
        };
        async function askBestieAboutImage(state, imageUrl) {
            try {
                console.log('Asking Bestie about image:', imageUrl);
                const [imageResponse, screenshotBlob] = await Promise.all([
                    fetch(imageUrl, { mode: 'cors' }),
                    captureScreenshot()
                ]);
                const imageBlob = await imageResponse.blob();
    
                // Convert Blobs to base64-encoded strings
                const imageBase64 = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(imageBlob);
                });
                const screenshotBase64 = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(screenshotBlob);
                });
    
                // Send the base64-encoded strings and MIME types to the background script
                chrome.runtime.sendMessage({
                    action: 'openPopup',
                    imageBase64: imageBase64,
                    screenshotBase64: screenshotBase64,
                    imageType: imageBlob.type,
                    screenshotType: screenshotBlob.type
                });
            } catch (error) {
                console.error('Error asking Bestie about image:', error);
            }
        }
        async function captureScreenshot() {
            const screenshotBlob = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (screenshotUrl) => {
                    fetch(screenshotUrl)
                        .then(response => response.blob())
                        .then(blob => resolve(blob))
                        .catch(error => {
                            console.error('Error converting screenshot to blob:', error);
                            resolve(null);
                        });
                });
            });
            console.log('Screenshot captured:', screenshotBlob);
            return screenshotBlob;
        }    
        
        function getHighestProbabilityClass(probabilities) {
            return Object.entries(probabilities).reduce((maxClass, [className, probability]) => {
                if (probability > maxClass.probability) {
                    return {
                        className,
                        probability
                    };
                }
                return maxClass;
            }, {
                className: null,
                probability: 0
            });
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
    
            if (className === 'Neutral' || className === 'Drawing') {
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
                chrome.runtime.sendMessage({
                    type: 'ANALYZE_IMAGE',
                    imageUrl: imageUrl
                }, (response) => {
                    if (response ?.type === 'ANALYSIS_RESULT') {
                        handleAnalysisResult(img, response.result, state);
                    } else if (response ?.type === 'ANALYSIS_ERROR') {
                        console.error('Analysis error:', response.error);
                    }
                });
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
                const {
                    className,
                    probability
                } = highestProbabilityClass;
                const label = createLabel(className, probability);
                labels.push(label);
            } else {
                const {
                    className,
                    probability
                } = highestProbabilityClass;
                const label = createLabel('Unrecognized', probability, className);
                labels.push(label);
            }
    
            const parentElement = element ?.parentElement;
            if (parentElement) removeExistingLabels(parentElement);
            appendLabels(parentElement, labels);
    
            if (probabilities['Neutral'] > 0.8 || probabilities['Drawing'] > 0.8) {
                uncensorImage(state, element.src);
            }
        }
    
        const init = async () => {
            try {
                const state = await loadSettings();
                setupMessageListener(state);
                if (state.allowlist.some(url => window.location.href.includes(url))) {
                    return;
                }
    
                if (state.censorEnabled) {
                    censorAllImages(state);
                    observeNewImages(state);
                    censorBadWords(state); // Add this line
                }
            } catch (error) {
                console.error('Error loading NSFWJS:', error);
            }
        };
    
        return {
            init
        };
    })();
    
    ImageCensor.init();
    
    function censorBadWords(state) {
        const elements = document.getElementsByTagName('*');
        const regex = new RegExp(`\\b(${state.badWords.join('|')})\\b`, 'gi');
    
        for (const element of elements) {
            if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
                const text = element.textContent;
                const replacedText = text.replace(regex, match => '*'.repeat(match.length));
                if (replacedText !== text) {
                    element.textContent = replacedText;
                }
            }
        }
    }
}


