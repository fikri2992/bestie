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

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "revealImage") {
        console.log("this info", info)
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
        // Forward the message to the offscreen document
        chrome.runtime.sendMessage(message, async (response) => {
            // Send the response back to the content script
            await sendResponse(response);
        });

        // Return true to indicate async response
        return true;
    }
});

function loadModelInOffscreen() {
    chrome.runtime.sendMessage({ type: 'LOAD_MODEL' });
}
