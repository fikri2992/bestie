// offscreen.js

let nsfwModel;

// Preload the NSFW.js model
async function loadModel() {
    nsfwModel = await nsfwjs.load(chrome.runtime.getURL('models/')); // You can specify 'quantized' or 'mobilenet' models
}

// Remove this line

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOAD_MODEL') {
        loadModel()
            .then(() => {
                console.log("Model loaded successfully.");
                sendResponse({ type: 'MODEL_LOADED' });
            })
            .catch((error) => {
                console.error('Error loading model:', error);
                sendResponse({ type: 'MODEL_LOAD_ERROR', error: error.message });
            });
        return true; // Keep the messaging channel open for async response
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

// Function to analyze the image
function analyzeImage(imageUrl) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Creating image element...");
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Set crossOrigin to allow loading images from different origins
            img.src = imageUrl;

            // Wait for the image to load
            await new Promise((r, s) => {
                img.onload = r;
                img.onerror = s;
            });

            console.log("Image loaded. Resizing...");
            // Create a canvas element to resize the image
            const canvas = document.createElement('canvas');
            canvas.width = 224;
            canvas.height = 224;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 224, 224);

            console.log("Image resized. Classifying...");
            // Perform the classification
            const predictions = await nsfwModel.classify(canvas);
            console.log("Classification completed.");
            resolve(predictions);
        } catch (error) {
            console.error('Error analyzing image:', error);
            reject(error);
        }
    });
}
