// offscreen.js

let nsfwModel;

// Preload the NSFW.js model
async function loadModel() {
    nsfwModel = await nsfwjs.load(chrome.runtime.getURL('models/')); // You can specify 'quantized' or 'mobilenet' models
}

loadModel();

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYZE_IMAGE') {
        const imageUrl = message.imageUrl;
        console.log("Analyzing image...");
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
    return new Promise((resolve, reject) => {
        console.log("Creating image element...");
        // Create an image element
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Necessary for cross-origin images
        img.src = imageUrl;

        // Wait for the image to load
        img.onload = async () => {
            try {
                console.log("Image loaded. Classifying...");
                // Perform the classification
                const predictions = await nsfwModel.classify(img);
                resolve(predictions);
            } catch (error) {
                console.error('Error during classification:', error);
                reject(error);
            }
        };

        img.onerror = (error) => {
            console.error('Error loading image:', error);
            reject(new Error('Failed to load image.'));
        };
    });
}
