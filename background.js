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
chrome.contextMenus.create({
    id: "bestieThinking",
    title: "Bestie Thinking",
    contexts: ["all"]
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
    } else if (info.menuItemId === "bestieThinking") {
        console.log("asdasdasdas")
        chrome.tabs.sendMessage(tab.id, {
            action: 'bestieThinking'
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
        if (message.action === 'bestieThinking') {
            console.log("bestieThinking", message)
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                chrome.tabs.captureVisibleTab(activeTab.windowId, { format: 'jpeg', quality: 100 }, (screenshotUrl) => {
                    fetch(screenshotUrl)
                        .then(response => response.blob())
                        .then(screenshotBlob => {
                            // chrome.tabs.sendMessage(activeTab.id, { action: 'getPageText' }, (response) => {
                                // const pageText = response.text;
                                setTimeout(() => {
                                    handleBestieThinking(screenshotBlob, message.text, message.currentUrl);
                                }, 100);
                            // });
                        })
                        .catch(error => {
                            console.error('Error capturing screenshot:', error);
                        });
                });
            });
            return true;
        }
        if (message.type === 'SEND_PAYLOAD') {
            sendPayload(message.messageData);
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

async function handleAskImageBestie(message) {
    try {
        const { imageBlob, screenshotBlob } = message;
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_START' });

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
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_START' });

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
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_START' });

        const response = await fetch('http://localhost:3000/thinking', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        chrome.runtime.sendMessage({ type: 'LOADING_CHAT_END' });
        chrome.runtime.sendMessage({ type: 'DISPLAY_MESSAGE', data: data });
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
    if (command === "toggle_image_censor") {
        chrome.storage.local.get(['censorEnabled'], (result) => {
            const newCensorState = !result.censorEnabled;
            chrome.storage.local.set({ censorEnabled: newCensorState }, () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        const action = newCensorState ? 'enableCensor' : 'disableCensor';
                        chrome.tabs.sendMessage(tabs[0].id, { action: action });
                    }
                });
            });
        });
    }
    if (command === "reveal_focused_image") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'revealFocusedImage' });
            }
        });
    }
});
