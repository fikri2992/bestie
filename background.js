// background.js
chrome.runtime.onInstalled.addListener(() => {
    console.log("NSFWJS Extension installed.");
    ensureOffscreenDocument().then(() => {
        // Forward the message to the offscreen document
        loadModelInOffscreen();
        // chrome.runtime.sendMessage(message, async (response) => {
        //     // Send the response back to the content script
        //     await sendResponse(response);
        // });
    });
    chrome.contextMenus.create({
        id: "revealImage",
        title: "Reveal Image",
        contexts: ["image"]
    });
    
    chrome.contextMenus.create({
        id: "askBestieAboutImage",
        title: "Ask Bestie about this image",
        contexts: ["image"]
    });
    
    // Add a context menu item for selected text
    chrome.contextMenus.create({
        id: "askBestieAboutText",
        title: "Ask Bestie about this text",
        contexts: ["selection"]
    });
});



chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "revealImage") {
        console.log("this info", info)
        chrome.tabs.sendMessage(tab.id, {
            action: 'revealImage',
            srcUrl: info.srcUrl
        });
    } else if (info.menuItemId === "askBestieAboutImage") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'askBestieAboutImage',
            srcUrl: info.srcUrl
        });
    } else if (info.menuItemId === "askBestieAboutText") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'askBestieAboutText',
            selectedText: info.selectionText
        });
    }
});

// background.js

// Function to ensure the offscreen document is created
async function ensureOffscreenDocument() {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['DOM_PARSER', 'IFRAME_SCRIPTING'],
        justification: 'Analyze images for NSFW content'
    });
}
  // Listen for messages from the content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'ANALYZE_IMAGE') {
            // Forward the message to the offscreen document
            chrome.runtime.sendMessage(message, async (response) => {
                // Send the response back to the content script
                await sendResponse(response);
            });

            // Return true to indicate async response
            return true;
        }

        if (message.action === 'captureScreenshot') {
            chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 }, (screenshotUrl) => {
                sendResponse(screenshotUrl);
            });
            return true; // Required to use sendResponse asynchronously
        }
        if (message.action === 'askBestieAboutImage') {
            console.log("askBestieAboutImage", message)
            chrome.windows.getAll({ populate: true, windowTypes: ['popup'] }, (windows) => {
                const popupWindow = windows.find(window => window.tabs.some(tab => tab.url.includes('popup.html')));
                if (!popupWindow) {
                    chrome.action.openPopup();
                }
            });
            return true; // Required to use sendResponse asynchronously
        }
        if (message.action === 'openPopup') {
            chrome.windows.getAll({ populate: true, windowTypes: ['popup'] }, (windows) => {
                const popupWindow = windows.find(window => window.tabs.some(tab => tab.url.includes('popup.html')));
                if (!popupWindow) {
                    chrome.action.openPopup();
                }
            });
            // Reconstruct the Blobs from base64-encoded strings
            const imageBlob = base64ToBlob(message.imageBase64, message.imageType);
            const screenshotBlob = base64ToBlob(message.screenshotBase64, message.screenshotType);
            setTimeout(() => {
                handleAskImageBestie({ imageBlob, screenshotBlob, ...message });
            }, 100);
            // Now you can proceed with your logic using the reconstructed Blobs

            sendResponse({ success: true });
            return true;
        }
        if (message.action === 'captureScreenshotWithText') {
            chrome.windows.getAll({ populate: true, windowTypes: ['popup'] }, (windows) => {
                const popupWindow = windows.find(window => window.tabs.some(tab => tab.url.includes('popup.html')));
                if (!popupWindow) {
                    chrome.action.openPopup();
                }
            });
            chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 }, (screenshotUrl) => {
                fetch(screenshotUrl)
                    .then(response => response.blob())
                    .then(screenshotBlob => {
                        setTimeout(() => {
                            handleAskTextBestie(message.selectedText, screenshotBlob);
                        }, 100);
            
                        sendResponse({ success: true });
                    })
                    .catch(error => {
                        console.error('Error capturing screenshot:', error);
                        sendResponse({ success: false });
                    });
            });
            return true; // Required to use sendResponse asynchronously
        }
    });

    function base64ToBlob(base64, mimeType) {
        const binaryString = atob(base64);
        const arrayBuffer = new ArrayBuffer(binaryString.length);
        const uint8Array = new Uint8Array(arrayBuffer);

        for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
        }

        return new Blob([uint8Array], { type: mimeType });
    }

    function loadModelInOffscreen() {
        chrome.runtime.sendMessage({ type: 'LOAD_MODEL' });
    }

    function handleAskImageBestie(message) {
        const { imageBlob, screenshotBlob } = message;
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_START' });
        const formData = new FormData();
        formData.append('image', imageBlob, 'image.jpg');
        formData.append('screenshot', screenshotBlob, 'screenshot.jpg');

        fetch('http://localhost:3000/img-bestie', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (response.ok) {
                response.json().then(data => {
                    // Handle the response data if needed
                    console.log('Image and screenshot uploaded successfully', data);
                    //send loading chat end to popupjs
                    chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
                });
            } else {
                console.error('Error uploading image and screenshot:', response.statusText);
            }
        })
        .catch(error => {
            console.error('Error asking Bestie about image:', error);
        });
    }

    function handleAskTextBestie(selectedText, screenshotBlob) {
        
        const formData = new FormData();
        formData.append('text', selectedText);
        formData.append('screenshot', screenshotBlob, 'screenshot.jpg');
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_START' });

        fetch('http://localhost:3000/wdyt-bestie', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (response.ok) {
                response.json().then(data => {
                    console.log('Text and screenshot uploaded successfully', data);
                    chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });

                });
            } else {
                console.error('Error uploading text and screenshot:', response.statusText);
            }
        })
        .catch(error => {
            console.error('Error asking Bestie about text:', error);
        });
    }

chrome.commands.onCommand.addListener((command) => {
    if (command === "open_popup") {
        chrome.windows.getAll({ populate: true, windowTypes: ['popup'] }, (windows) => {
            const popupWindow = windows.find(window => window.tabs.some(tab => tab.url.includes('popup.html')));
            if (!popupWindow) {
                chrome.action.openPopup();
            } else {
                // Focus the existing popup window
                chrome.windows.update(popupWindow.id, { focused: true });
            }
        });

        // Send a message to the popup to focus the chat input field
        chrome.runtime.sendMessage({ action: 'focusChatInput' });
    }
});
