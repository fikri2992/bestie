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
        chrome.tabs.sendMessage(tab.id, { action: 'revealImage', srcUrl: info.srcUrl });
    }
});