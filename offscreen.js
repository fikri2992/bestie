// offscreen.js

let nsfwModel;

async function loadModel() {
    try {
        nsfwModel = await nsfwjs.load(chrome.runtime.getURL('models/'));
        return { type: 'MODEL_LOADED', success: true };
    } catch (error) {
        console.error('Error loading model:', error);
        return { type: 'MODEL_LOAD_ERROR', error: error.message };
    }
}

// Modify the message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOAD_MODEL') {
        loadModel()
            .then((response) => {
                sendResponse(response);
            });
        return true; // Keep the messaging channel open for async response
    }
    if (message.action === 'askImageBestie') {
        handleAskImageBestie(message);
    } else if (message.action === 'askTextBestie') {
        handleAskTextBestie(message.selectedText, message.screenshotBlob);
    } else if (message.action === 'bestieThinking') {
        handleBestieThinking(message.screenshotBlob, message.pageText, message.currentUrl);
    } else if (message.action === 'sendPayload') {
        sendPayload(message.messageData);
    }
    if (message.type === 'ANALYZE_IMAGE') {
        const imageUrl = message.imageUrl;
        console.log("Analyzing image...", imageUrl);
        analyzeImage(imageUrl)
            .then((predictions) => {
                // Handle the classification predictions
                console.log("Analyzing finished...", predictions);
                sendResponse({
                    type: 'ANALYSIS_RESULT',
                    result: predictions
                });
            })
            .catch((error) => {
                // Handle any errors that occurred during the analysis
                console.error('Error analyzing image:', error);
                sendResponse({
                    type: 'ANALYSIS_ERROR',
                    error: error.message
                });
            });
    }
    return true; // Keep the messaging channel open for async response
});

async function analyzeImage(imageUrl) {
    try {
        // First, ensure the model is loaded
        if (!nsfwModel) {
            await loadModel(); // Initialize the model if not already loaded
        }

        console.log("Fetching image...");

        // Fetch the image data with appropriate CORS settings
        const response = await fetch(imageUrl, {
            mode: 'cors',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Image Blocked by server, cannot get image data');
        }

        const blob = await response.blob();
        const img = new Image();

        // Create a blob URL and set it as the image source
        const url = URL.createObjectURL(blob);
        img.src = url;

        // Wait for the image to load
        await new Promise((resolve, reject) => {
            img.onload = () => {
                URL.revokeObjectURL(url); // Clean up the URL object
                resolve();
            };
            img.onerror = (error) => {
                URL.revokeObjectURL(url); // Clean up on error as well
                reject(error);
            };
        });

        console.log("Image loaded. Resizing...");
        const canvas = document.createElement('canvas');
        canvas.width = 224;
        canvas.height = 224;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 224, 224);

        console.log("Image resized. Classifying...");

        // Ensure nsfwModel exists before classifying
        if (!nsfwModel) {
            throw new Error('NSFW model failed to load');
        }

        const predictions = await nsfwModel.classify(canvas);
        console.log("Classification completed.");
        return predictions;
    } catch (error) {
        console.error('Error analyzing image:', error);
        throw error;
    }
}


