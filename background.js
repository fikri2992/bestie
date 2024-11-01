// background.js
chrome.runtime.onInstalled.addListener(() => {
    console.log("NSFWJS Extension installed.");
});

chrome.contextMenus.create({
    id: "revealImage",
    title: "Reveal Image",
    contexts: ["image"]
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "revealImage") {
        chrome.tabs.sendMessage(tab.id, {
            action: 'revealImage',
            srcUrl: info.srcUrl
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
        // Ensure the offscreen document is available
        ensureOffscreenDocument().then(() => {
            // Forward the message to the offscreen document
            chrome.runtime.sendMessage(message, async (response) => {
                // Send the response back to the content script
                console.log("masuk sini gan", message, response)
                await sendResponse(response);
            });
        });

        // Return true to indicate async response
        return true;
    }

    if (message.type === 'modelLoaded') {
        // Ensure the offscreen document is available
        ensureOffscreenDocument().then(() => {
            // Forward the message to the offscreen document
            chrome.runtime.sendMessage(message, async (response) => {
                // Send the response back to the content script
                await sendResponse(response);
            });
        });

        // Return true to indicate async response
        return true;
    }
});
