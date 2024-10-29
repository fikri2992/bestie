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
        
        // Check if imageUrl is a valid URL
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
            return element; // Skip processing if not a valid URL
        }

        const baseUrl = getBaseUrl(imageUrl);
        if (!state.censorEnabled || element.dataset.censored || state.revealedImages[baseUrl]) return element;

        // Check if the element has a background image and is large enough
        const isLargeEnough = element.offsetWidth >= 128 && element.offsetHeight >= 128;
        if (!imageUrl || !isLargeEnough) return element;

        element.dataset.censored = "true";
        element.style.filter = `blur(${state.blurIntensity}px)`;
        element.style.transition = "none";

        const parentElement = element.parentElement;
        if (parentElement && window.getComputedStyle(parentElement).position === "static") {
            parentElement.style.position = "relative";
        }

        element.addEventListener("load", () => {
            if (!state.revealedImages[baseUrl]) {
                element.style.filter = `blur(${state.blurIntensity}px)`;
            }
        });

        return element;
    };


    const updateRevealedImages = state =>
        new Promise(resolve =>
            chrome.storage.local.set({
                revealedImages: state.revealedImages
            }, () => resolve(state))
        );

    const censorAllImages = state => {
        const images = Array.from(document.querySelectorAll("img, div[style*='background-image']"));
        images.forEach(blurElement(state));
    };

    const removeAllCensors = () => {
        const elements = Array.from(document.querySelectorAll("[data-censored]"));
        elements.forEach(element => {
            element.style.filter = "none";
            delete element.dataset.censored;
        });
    };

    const observeNewImages = state => {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    // Delay the check for new images
                    setTimeout(() => { 
                        if (node.tagName === "IMG" || (node.tagName === "DIV" && node.style.backgroundImage)) {
                            blurElement(state)(node);
                        }
                        if (node.querySelectorAll) {
                            const newImages = Array.from(node.querySelectorAll("img, div[style*='background-image']"));
                            newImages.forEach(blurElement(state));
                        }
                    }, 500); // Adjust delay (in milliseconds) as needed 
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
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
    };    const init = async () => {
        const state = await loadSettings();
        setupMessageListener(state);
        observeNewImages(state);
        if (state.censorEnabled) {
            censorAllImages(state);
        }
    };

    return {
        init
    };
})();

ImageCensor.init();
