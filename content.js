// contentScript.js
console.log('Content script loaded on', window.location.href);

const ImageCensor = (() => {
    let model = null;
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
        const isLargeEnough = element.offsetWidth >= 128 || element.offsetHeight >= 128;
        if (!imageUrl || !isLargeEnough) return element;

        // Hide the element initially
        // element.style.visibility = 'hidden';

        // Delay showing the blurred image
        // setTimeout(() => {
            element.dataset.censored = "true";
            element.classList.add("censored-image"); // Add a unique class to the element
            element.style.setProperty("filter", `blur(${state.blurIntensity}px)`, "important");
            // element.style.visibility = 'visible'; // Show the element with the blur applied
        // }, 500); // Adjust the delay (in milliseconds) as needed

        // const parentElement = element.parentElement;
        // if (parentElement && window.getComputedStyle(parentElement).position === "static") {
        //     parentElement.style.position = "relative";
        // }

        return element;
    };

    const censorAllImages = state => {
        console.log("Asdasdamasuk sini ")
        const images = Array.from(document.querySelectorAll("img, div[style*='background-image']"));
        console.log(images)
        images.forEach(element => {
            // Start scanning images when the content script runs
            scanImages(element);
            // checkNSFWContent(state, model, [element]);
            blurElement(state)(element)
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
    };

    // const observeNewImages = (state, model) => {
    //     const observer = new MutationObserver(mutations => {
    //         mutations.forEach(mutation => {
    //             mutation.addedNodes.forEach(node => {
    //                 // Delay the check for new images
    //                 setTimeout(() => {
    //                     if (node.tagName === "IMG") {
    //                         checkNSFWContent(state, model, [node]);
    //                     }
    //                     if (node.querySelectorAll) {
    //                         const newImages = Array.from(node.querySelectorAll("div[style*='background-image']"));
    //                         checkNSFWContent(state, model, newImages);
    //                     }
    //                 }, 500); // Adjust delay (in milliseconds) as needed 
    //             });
    //         });
    //     });

    //     observer.observe(document.body, {
    //         childList: true,
    //         subtree: true
    //     });

    //     return observer;
    // };

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

        const parentElement = element.parentElement;
        if (parentElement && window.getComputedStyle(parentElement).position === "static") {
            parentElement.style.position = "relative";
        }

        parentElement.appendChild(label);
    };
    const checkNSFWContent = async (state, model, elements = null) => {
        console.log("masuk sini captain");
        const images = elements || Array.from(document.querySelectorAll("img, div[style*='background-image']"));

        for (const element of images) {
            const imageUrl = element.tagName === 'IMG' ? element.src : element.style.backgroundImage.slice(4, -1).replace(/"/g, "");

            if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
                continue;
            }

            const baseUrl = getBaseUrl(imageUrl);
            if (!state.censorEnabled || element.dataset.censored || state.revealedImages[baseUrl]) continue;

            const isLargeEnough = element.offsetWidth >= 128 || element.offsetHeight >= 64;
            if (!imageUrl || !isLargeEnough) continue;

            // Blur the image instantly without waiting for NSFWJS
            // blurElement(state)(element);

            try {
                // Create a new image element to load the image
                const img = new Image();
                img.src = imageUrl;
                await new Promise((resolve) => {
                    img.onload = resolve;
                });

                // Create a canvas element to resize the image
                const canvas = document.createElement('canvas');
                canvas.width = 224;
                canvas.height = 224;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 224, 224);

                // Get the resized image data from the canvas
                const imageData = ctx.getImageData(0, 0, 224, 224);

                // Classify the resized image using the NSFWJS model
                const predictions = await model.classify(imageData);
                const nsfwProbability = predictions.find(
                    (pred) => pred.className === 'Porn' || pred.className === 'Hentai'
                )?.probability;
                console.log("prediction :", nsfwProbability )
                // Add NSFW label if the probability is above the threshold
                if (nsfwProbability > 0.7) {
                    addNSFWLabel(element, nsfwProbability);
                } else {
                    console.log("Asdasdas", element, nsfwProbability)
                    addNSFWLabel(element, nsfwProbability);
                    // uncensorImage(state, imageUrl);
                }
            } catch (error) {
                console.error('Error classifying image:', error);
            }
        }
    };
    // content.js

    // Function to scan images on the page
    function scanImages(img) {
        // for (const img of images) {
            // Mark image as scanned
            img.dataset.nsfwScanned = 'true';
            // Wait for the image to load
            if (img.complete && img.naturalHeight !== 0) {
                analyzeImage(img);
            } else {
                // img.onload = () => analyzeImage(img);
            }
        // }
    }

    // Function to request image analysis
    function analyzeImage(img) {
        const imageUrl = img.src;

        // Send message to background script to analyze the image
        chrome.runtime.sendMessage({
                type: 'ANALYZE_IMAGE',
                imageUrl: imageUrl
            },
            (response) => {
                console.log(response)
                if (response.type === 'ANALYSIS_RESULT') {
                    handleAnalysisResult(img, response.result);
                    console.log(response)
                } else if (response.type === 'ANALYSIS_ERROR') {
                    console.error('Analysis error:', response.error);
                }
            }
        );
    }

    // Function to handle the analysis result
    function handleAnalysisResult(img, result) {
        // Check if the image is classified as NSFW
        const nsfwScore = result.find((prediction) => prediction.className === 'Pornography').probability;
        console.log("nsfwScore", nsfwScore)
        if (nsfwScore > 0.7) {
            // Blur the image or replace it
            img.style.filter = 'blur(10px)';
            img.title = 'NSFW content detected';
        }
    }

    const init = async () => {
        try {
            const state = await loadSettings();
            
            censorAllImages(state);
            setupMessageListener(state);
            // observeNewImages(state, model);
            // chrome.runtime.sendMessage({
            //     type: 'modelLoaded',
            // }, (response) => {
            //     console.log(response)
            //     if (response?.type === 'Model_Loaded') {
            //         console.log(response.result)
            //     } else if (response?.type === 'ANALYSIS_ERROR') {
            //         console.error('Analysis error:', response.error);
            //     }
            // }
        // );
        } catch (error) {
            console.error('Error loading NSFWJS:', error);
        }
    };

    return {
        init
    };
})();

ImageCensor.init();


