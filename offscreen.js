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
            return new Promise(async (resolve, reject) => {
                try {
                    // First, ensure the model is loaded
                    if (!nsfwModel) {
                        await loadModel(); // Call the loadModel function to initialize the model
                    }

                    console.log("Creating image element...");
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = imageUrl;

                    // Wait for the image to load
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
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
                    resolve(predictions);
                } catch (error) {
                    console.error('Error analyzing image:', error);
                    reject(error);
                }
            });
}

async function handleAskImageBestie(message) {
    try {
        const { imageBlob, screenshotBlob } = message;
        const formData = new FormData();
        formData.append('image', imageBlob, 'image.jpg');
        formData.append('screenshot', screenshotBlob, 'screenshot.jpg');

        const response = await fetch('http://localhost:3000/img-bestie', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log('Image and screenshot uploaded successfully', data);
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
        chrome.runtime.sendMessage({ type: 'DISPLAY_MESSAGE', data });
    } catch (error) {
        console.error('Error asking Bestie about image:', error);
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
        chrome.runtime.sendMessage({ type: 'DISPLAY_ERROR', error: error.message });
    }
}

async function handleAskTextBestie(selectedText, screenshotBlob) {
    try {
        const formData = new FormData();
        formData.append('text', selectedText);
        formData.append('screenshot', screenshotBlob, 'screenshot.jpg');

        const response = await fetch('http://localhost:3000/wdyt-bestie', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log('Text and screenshot uploaded successfully', data);
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
        chrome.runtime.sendMessage({ type: 'DISPLAY_MESSAGE', data });
    } catch (error) {
        console.error('Error asking Bestie about text:', error);
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
        chrome.runtime.sendMessage({ type: 'DISPLAY_ERROR', error: error.message });
    }
}

async function handleBestieThinking(screenshotBlob, pageText, currentUrl) {
    try {
        const formData = new FormData();
        formData.append('screenshot', screenshotBlob, 'screenshot.jpg');
        formData.append('context', JSON.stringify({ text: pageText, currentUrl }));

        const response = await fetch('http://localhost:3000/thinking', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
        chrome.runtime.sendMessage({ type: 'DISPLAY_MESSAGE', data });
    } catch (error) {
        console.error('Error in Bestie Thinking:', error);
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
        chrome.runtime.sendMessage({ type: 'DISPLAY_ERROR', error: error.message });
    }
}

async function sendPayload(messageData) {
    try {
        const response = await fetch('http://localhost:3000/api/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Add any other headers your API requires, like authorization
            },
            body: JSON.stringify(messageData)
        });
        if (response.ok) {
            const data = await response.json();
            chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
            // Send a message to popup.js to call displayMessage with the response data
            chrome.runtime.sendMessage({ type: 'DISPLAY_MESSAGE', data });
        } else {
            throw new Error(`API request failed with status ${response.status}`);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        // Handle the error, e.g., display an error message to the user
        // chrome.runtime.sendMessage({ type: 'CHAT_ERROR', error: error.message });
    }
}