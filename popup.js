// Get DOM elements
const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.getElementById('main-chat-input');

const sendButton = document.querySelector('.send-button');
const clearChatButton = document.getElementById('clearChatButton');
const attachImageButton = document.getElementById('attachImageButton');
const imageUpload = document.getElementById('imageUpload');
let typingInterval;
// Function to load chat messages from storage
function loadChatMessages() {
    //console log all storage local
    chrome.storage.local.get(['chatMessages'], (result) => {
        if (result.chatMessages) {
            chatMessages.innerHTML = ''; // Clear existing messages
            result.chatMessages.forEach(message => {
                addMessage(message.text, message.sender, message.imageData);
            });
            // Scroll to the bottom after loading all messages
            
        }
    });


} // Replace with your server address
loadChatMessages();
// Function to add a new message to the chat
function addMessage(message, sender, messageData = null) {
    // Create the message container element first
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    chatMessages.appendChild(messageElement);

    if (messageData) {
        if (messageData.imageData) {
            const imageElement = document.createElement('img');
            imageElement.src = messageData.imageData;
            imageElement.classList.add('image-preview');
            messageElement.appendChild(imageElement);
        }
        if (messageData.text) {
            messageElement.textContent = messageData.text;
        }
    } else {
        messageElement.textContent = message;
    }
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

// Function to save chat messages to storage
function saveChatMessages() {
    const messages = Array.from(chatMessages.children).map(messageElement => ({
        text: messageElement.textContent,
        sender: messageElement.classList.contains('user') ? 'user' : 'server',
        imageData: messageElement.querySelector('img') ? messageElement.querySelector('img').src : null
    }));
    chrome.storage.local.set({
        chatMessages: messages
    });
}

// Function to clear chat messages
function clearChat() {
    chatMessages.innerHTML = ''; // Clear chat messages from UI
    chrome.storage.local.remove('chatMessages'); // Clear from storage
}

// Event listeners
sendButton.addEventListener('click', () => {
    sendMessage();
    saveChatMessages(); // Save messages after sending
});

// chatInput.addEventListener('keyup', (event) => {

// });

clearChatButton.addEventListener('click', clearChat);

// Receive message (including potential image data)
function displayMessage(data) {
    console.log("data", data)
    const text = data.text;
    const imgUrl = data.imageUrl;
    // Add the typing animation before displaying the message
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'server');
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    // Add typing animation (three dots)
    const typingDots = document.createElement('span');
    typingDots.classList.add('typing-dots');
    typingDots.innerHTML = '...'; // Start with one dot
    messageElement.appendChild(typingDots);
    // Simulate typing animation
    let dotCount = 1;
    const typingInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4; // Cycle through 1, 2, 3, 0 dots
        typingDots.innerHTML = '.'.repeat(dotCount);
    }, 300);
    // Simulate a delay (e.g., for network request)
    setTimeout(() => {
        clearInterval(typingInterval); // Stop the animation
        typingDots.remove(); // Remove the dots
        // Get the last message element (which is the placeholder with typing animation)
        const lastMessageElement = chatMessages.lastElementChild;
        // Update the last message element with the actual message content
        if (imgUrl) {
            const imageElement = document.createElement('img');
            imageElement.src = imgUrl;
            imageElement.classList.add('image-preview');
            lastMessageElement.innerHTML = ''; // Clear the placeholder content
            lastMessageElement.appendChild(imageElement);
        } else {
            lastMessageElement.textContent = text; // Update text content
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
        saveChatMessages(); // Save messages after receiving
    }, 700); // Adjust delay as needed
}


// Adjust textarea height automatically
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
});

// Handle keydown events
chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && chatInput.value) {
        if (!e.shiftKey) {
            // Prevent default behavior
            e.preventDefault();
            // Trigger send message function
            sendMessage();
            // Clear the input
            chatInput.value = '';
            // Reset the height
            chatInput.style.height = 'auto';
        }
        // If Shift+Enter, allow the newline (default behavior)
    }
});

// Function to send the message
function sendMessage() {
    const messageText = chatInput.value.trim();
    const messageData = {}; // Start with an empty object

    // Determine message type
    if (imageUpload?.files?.length > 0 && messageText !== "") {
        messageData.type = 'text_image'; // Both text and image
    } else if (imageUpload?.files?.length > 0) {
        messageData.type = 'image'; // Image only
    } else {
        messageData.type = 'text'; // Text only
    }

    // Add text content (if any)
    if (messageText !== "") {
        messageData.text = messageText;
    }

    // Handle image upload (if any)
    if (imageUpload?.files?.length > 0) {
        const file = imageUpload.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            messageData.imageData = e.target.result;
            sendMessageToServer(messageData);
        };
        reader.readAsDataURL(file);
    } else {
        // Send text-only message immediately
        sendMessageToServer(messageData);
    }

    // Reset the input height after sending

}

// Function to send the message to the server
function sendMessageToServer(messageData) {
    chrome.runtime.sendMessage({ type: 'SEND_PAYLOAD', messageData: messageData });
    addMessage('You', 'user', messageData);
    startTypingAnimation();
    setTimeout(() => {
        chatInput.style.height = '38px'; // Set a default minimal height
        chatInput.value = '';
    }, 100);
    // imageUpload.value = ''; // Clear the file input
    //reset height 
}

// Tab switching logic
const tabs = document.querySelectorAll('.tab');
const contentAreas = document.querySelectorAll('.content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and hide all content areas
        tabs.forEach(t => t.classList.remove('active'));
        contentAreas.forEach(area => {
            area.classList.remove('active');
            area.style.display = 'none'; // Hide the content area
        });

        // Add active class to clicked tab and show corresponding content area
        const targetId = tab.dataset.target;
        tab.classList.add('active');
        document.getElementById(targetId).classList.add('active');
        document.getElementById(targetId).style.display = 'block'; // Show the content
    });
});

// Initially show only the first tab's content
contentAreas.forEach((area, index) => {
    if (index !== 0) {
        area.style.display = 'none';
    } else {
        area.style.display = 'block'; // Ensure the first tab is visible
    }
});

// Add this function to handle the strict mode toggle
function initializeStrictModeToggle() {
    const strictModeToggle = document.getElementById('strictModeToggle');

    // Load the current state of the strictMode setting
    chrome.storage.local.get('strictMode', (result) => {
        strictModeToggle.checked = result.strictMode === true;
    });

    strictModeToggle.addEventListener('change', function () {
        const strictMode = strictModeToggle.checked;
        chrome.storage.local.set({ strictMode: strictMode }, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleStrictMode', strictMode: strictMode });
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    initializeCensorToggle();
    initializeStrictModeToggle(); // Add this line
    checkUserProfile();
    loadAllowlist();
    loadBadWords();
    toggleLabel();
});

function toggleLabel() {
    const showLabelToggle = document.getElementById('showLabelToggle');

    // Load the current state of the showLabels setting
    chrome.storage.local.get('showLabels', (result) => {
        showLabelToggle.checked = result.showLabels !== false;
    });

    showLabelToggle.addEventListener('change', function () {
        const showLabels = showLabelToggle.checked;
        console.log(showLabels)
        chrome.storage.local.set({ showLabels: showLabels }, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleShowLabels', showLabels: showLabels });
            });
        });
    });
}
function initializeCensorToggle() {
    const censorToggle = document.getElementById('censorToggle');
    // Initialize the toggle based on stored settings
    chrome.storage.local.get(['censorEnabled'], function (result) {
        censorToggle.checked = result.censorEnabled !== false;
    });

    censorToggle.addEventListener('change', function () {
        // Get the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const activeTab = tabs[0];
            if (activeTab && activeTab.id) {
                const action = censorToggle.checked ? 'enableCensor' : 'disableCensor';
                chrome.tabs.sendMessage(activeTab.id, { action: action }, function (response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message to content script:', chrome.runtime.lastError);
                    } else {
                        console.log(`Censor ${action === 'enableCensor' ? 'enabled' : 'disabled'}`);
                    }
                });
                chrome.storage.local.set({ censorEnabled: censorToggle.checked });
            } else {
                console.error('No active tab found');
            }
        });
    });
}

function checkUserProfile() {
    chrome.storage.local.get(['displayName', 'age'], (result) => {
        const chatInterface = document.getElementById('chatInterface');
        const profileForm = document.getElementById('profileForm');

        if (result.displayName && result.age) {
            // Profile exists, show chat interface
            chatInterface.style.display = 'block';
            profileForm.style.display = 'none';
        } else {
            // Profile doesn't exist, show the form
            profileForm.style.display = 'block';
            chatInterface.style.display = 'none';
        }
    });

    // Handle form submission
    const submitButton = document.getElementById('submitProfile');
    submitButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default form submission

        const displayName = document.getElementById('displayName').value;
        const age = document.getElementById('age').value;

        // Basic validation (you can add more)
        if (displayName && age) {
            // Save profile data to storage
            chrome.storage.local.set({ displayName, age }, () => {
                // Show chat interface
                profileForm.style.display = 'none';
                chatInterface.style.display = 'block';
            });
        } else {
            // Handle invalid input (e.g., show an error message)
            alert('Please enter both your name and age.');
        }
    });
}

// Get the "Clear All Data" button element
const clearAllDataButton = document.getElementById('clearAllDataButton');

// Add event listener to the "Clear All Data" button
clearAllDataButton.addEventListener('click', () => {
    // Show a confirmation dialog
    const confirmClear = confirm('Are you sure you want to clear all data? This action cannot be undone.');
    
    if (confirmClear) {
        // Clear all data from local storage
        chrome.storage.local.clear(() => {
            // Reload the extension popup
            location.reload();
        });
    }
});

// Function to save allowlist
function saveAllowlist() {
    const allowlistTextarea = document.getElementById('allowlistTextarea');
    const allowlist = allowlistTextarea.value.split('\n').map(url => url.trim()).filter(url => url !== '');
    chrome.storage.local.set({ allowlist }, () => {
        console.log('Allowlist saved');
    });
}

// Function to load allowlist
function loadAllowlist() {
    chrome.storage.local.get(['allowlist'], (result) => {
        const allowlistTextarea = document.getElementById('allowlistTextarea');
        allowlistTextarea.value = result.allowlist ? result.allowlist.join('\n') : '';
    });
}

// Event listener for saving allowlist
const saveAllowlistButton = document.getElementById('saveAllowlistButton');
saveAllowlistButton.addEventListener('click', saveAllowlist);


// Function to save bad words
function saveBadWords() {
    const badWordsTextarea = document.getElementById('badWordsTextarea');
    const badWords = badWordsTextarea.value.split('\n').map(word => word.trim()).filter(word => word !== '');
    chrome.storage.local.set({ badWords }, () => {
        console.log('Bad words saved');
    });
}

// Function to load bad words
function loadBadWords() {
    chrome.storage.local.get(['badWords'], (result) => {
        const badWordsTextarea = document.getElementById('badWordsTextarea');
        badWordsTextarea.value = result.badWords ? result.badWords.join('\n') : '';
    });
}

// Event listener for saving bad words
const saveBadWordsButton = document.getElementById('saveBadWordsButton');
saveBadWordsButton.addEventListener('click', saveBadWords);


// Function to start the typing animation
function startTypingAnimation() {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'server');
    
    const typingDots = document.createElement('span');
    typingDots.classList.add('typing-dots');
    typingDots.innerHTML = '...'; // Start with one dot
    
    messageElement.appendChild(typingDots); // Append dots inside the bubble
    chatMessages.appendChild(messageElement);
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 500);

    let dotCount = 1;
    typingInterval = setInterval(() => {
        typingDots.innerHTML = '.'.repeat(dotCount);
        dotCount = (dotCount % 4) +1; // Cycle through 1, 2, 3, 4 dots
    }, 400);
}

// Function to stop the typing animation
function stopTypingAnimation() {
    clearInterval(typingInterval); // Stop the animation
    const typingDots = document.querySelector('.typing-dots');
    if (typingDots) {
        typingDots.parentElement.remove(); // Remove the entire message bubble
    }
}

// Receive LOADING_CHAT_START and LOADING_CHAT_END messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOADING_CHAT_START') {
        console.log('Received LOADING_CHAT_START message');
        startTypingAnimation();
    }
    if (message.type === 'LOADING_CHAT_END') {
        stopTypingAnimation();
    }
    if (message.action === 'focusChatInput') {
        const chatInput = document.querySelector('#main-chat-input'); // Adjust the selector as needed
        if (chatInput) {
            chatInput.focus();
        }
    }
    if (message.type === 'DISPLAY_MESSAGE') {
        console.log("should be here")
        displayMessage(message.data);
    }
});


