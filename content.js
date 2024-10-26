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
            if (url.startsWith('data:')) {
                return url;
            }
            const urlObj = new URL(url);
            return urlObj.origin + urlObj.pathname;
        } catch (error) {
            console.error('Invalid URL:', url, error);
            return url;
        }
    };

    const blurImage = state => image => {
        const baseUrl = getBaseUrl(image.src);
        if (!state.censorEnabled || image.dataset.censored || state.revealedImages[baseUrl]) return image;

        const isSmallImage = image.width < 128 && image.height < 128;
        if (isSmallImage) return image;

        image.dataset.censored = "true";
        image.style.filter = `blur(${state.blurIntensity}px)`;
        image.style.transition = "none"; // Remove transition for instant blur

        const parentElement = image.parentElement;
        if (parentElement && window.getComputedStyle(parentElement).position === "static") {
            parentElement.style.position = "relative";
        }

        image.addEventListener("load", () => {
            if (!state.revealedImages[baseUrl]) {
                image.style.filter = `blur(${state.blurIntensity}px)`;
            }
        });

        return image;
    };

    const updateRevealedImages = state =>
        new Promise(resolve =>
            chrome.storage.local.set({
                revealedImages: state.revealedImages
            }, () => resolve(state))
        );

    const censorAllImages = state => {
        const images = Array.from(document.querySelectorAll("img"));
        images.forEach(blurImage(state));
    };

    const removeAllCensors = () => {
        const images = Array.from(document.querySelectorAll("img[data-censored]"));
        images.forEach(image => {
            image.style.filter = "none";
            delete image.dataset.censored;
        });
    };

    const observeNewImages = state => {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.tagName === "IMG") {
                        blurImage(state)(node);
                    }
                    if (node.querySelectorAll) {
                        const newImages = Array.from(node.querySelectorAll("img"));
                        newImages.forEach(blurImage(state));
                    }
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
                const image = Array.from(document.images).find(img => img.src === message.srcUrl);
                if (image) {
                    const baseUrl = getBaseUrl(image.src);
                    image.style.filter = "none";
                    state.revealedImages[baseUrl] = true;
                    updateRevealedImages(state);
                    delete image.dataset.censored;
                }
            }
        });
    };
    const init = async () => {
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