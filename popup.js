// Get DOM elements for chat interface
console.log('Popup script loaded');
// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOADING_CHAT_START') {
        startTypingAnimation();
    }
    if (message.type === 'LOADING_CHAT_END') {
        stopTypingAnimation();
    }
    if (message.action === 'focusChatInput') {
        const chatInput = document.querySelector('#main-chat-input');
        if (chatInput) {
            chatInput.focus();
        }
    }
    if (message.type === 'DISPLAY_MESSAGE') {
        console.log('Received message:', message);
        displayMessage(message.data);
    }
    if (message.type === 'ADD_USER_MESSAGE') {
        console.log('ADD_USER_MESSAGE Received message:', message);
        addMessage(message.data.text, 'user');
        // displayMessage(message.data);
    }
});

const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.getElementById('main-chat-input');
const sendButton = document.querySelector('.send-button');
const clearChatButton = document.getElementById('clearChatButton');

let typingInterval; // Interval for typing animation

// Function to load chat messages from local storage
function loadChatMessages() {
    chrome.storage.local.get(['chatMessages'], (result) => {
        if (result.chatMessages) {
            chatMessages.innerHTML = ''; // Clear existing messages
            result.chatMessages.forEach(message => {
                addMessage(message.text, message.sender, message.imageData);
            });
            // Scroll to the bottom after loading all messages
        }
    });
}
// Function to load chat history from local storage
function loadChatHistory() {
    chrome.storage.local.get(['chatHistory'], (result) => {
        if (result.chatHistory) {
            chatMessages.innerHTML = ''; // Clear existing messages
            result.chatHistory.forEach(entry => {
                const messageText = entry.parts.map(part => part.text).join(' ');
                addMessage(messageText, entry.role === 'model' ? 'server' : 'user');
            });
            // Scroll to the bottom after loading all messages
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}

// Load chat messages and chat history on startup
loadChatMessages();
loadChatHistory();
// Function to add a new message to the chat
function addMessage(message, sender, messageData = null) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    chatMessages.appendChild(messageElement);
    
    if (messageData) {
        if (messageData.text) {
            messageElement.textContent = messageData.text;
        }
    } else {
        messageElement.textContent = message;
    }
    saveChatMessages(); // Save messages after sending
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to the bottom
    }, 150);
}

// Function to clear chat messages
function clearChat() {
    const confirmClear = confirm('Are you sure you want to clear the entire chat history? This action cannot be undone.');
    
    if (confirmClear) {
        chatMessages.innerHTML = ''; // Clear chat messages from UI
        chrome.storage.local.remove(['chatMessages', 'chatHistory'], () => {
            // Show feedback to the user
            const tempNotification = document.createElement('div');
            tempNotification.textContent = 'Chat cleared successfully';
            tempNotification.classList.add('notification');
            document.body.appendChild(tempNotification);
            
            // Remove the notification after 2 seconds
            setTimeout(() => {
                document.body.removeChild(tempNotification);
            }, 2000);
        });
    }
}

// Event listeners for buttons
sendButton.addEventListener('click', () => {
    sendMessage();
});

clearChatButton.addEventListener('click', clearChat);

// Function to display a received message
function displayMessage(data) {
    console.log('Received message:', data);
    //console log chatHistory from local storage
    console.log('chatHistory:', chrome.storage.local.get(['chatHistory']));
    const text = data.text;
    const imgUrl = data.imageUrl;
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

        // Update the last message element with the actual message content
        if (imgUrl) {
            const imageElement = document.createElement('img');
            imageElement.src = imgUrl;
            imageElement.classList.add('image-preview');
            messageElement.innerHTML = ''; // Clear the placeholder content
            messageElement.appendChild(imageElement);
        } else {
            messageElement.textContent = text; // Update text content
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 700); // Adjust delay as needed
}

// Adjust textarea height automatically
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
});

// Function to send the message
function sendMessage() {
    const messageText = chatInput.value.trim();
    const messageData = {}; // Start with an empty object

    // Determine message type
    messageData.type = 'text'; // Text only

    // Add text content (if any)
    if (messageText !== "") {
        messageData.text = messageText;
    }
    
    // Handle image upload (if any)
    sendMessageToServer(messageData);

    // Reset the input height after sending
}

// Function to save chat messages to local storage
function saveChatMessages() {
    const messages = Array.from(chatMessages.children).map(messageElement => ({
        text: messageElement.textContent,
        sender: messageElement.classList.contains('user') ? 'user' : 'server',
    }));
    chrome.storage.local.set({
        chatMessages: messages
    });
}

// Function to send the message to the server
function sendMessageToServer(messageData) {
    chrome.runtime.sendMessage({ type: 'sendPayload', messageData: messageData });
    addMessage('You', 'user', messageData);
    startTypingAnimation();
    setTimeout(() => {
        chatInput.style.height = '38px'; // Set a default minimal height
        chatInput.value = '';
    }, 100);
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

// Initialize the strict mode toggle
function initializeStrictModeToggle() {
    const strictModeToggle = document.getElementById('strictModeToggle');

    // Load the current state of the strictMode setting
    chrome.storage.local.get('strictMode', (result) => {
        strictModeToggle.checked = result.strictMode !== false;
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

// Initialize the popup on DOM content loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeCensorToggle();
    initializeStrictModeToggle(); // Add this line
    checkUserProfile();
    loadAllowlist();
    // loadBadWords();
    toggleLabel();

    // Handle keydown events for chat input
    chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && chatInput.value) {
            if (!e.shiftKey) {
                e.preventDefault(); // Prevent default behavior
                sendMessage(); // Trigger send message function
                chatInput.value = ''; // Clear the input
                chatInput.style.height = 'auto'; // Reset the height
            }
        }
    });
});

// Toggle label visibility
function toggleLabel() {
    const showLabelToggle = document.getElementById('showLabelToggle');

    // Load the current state of the showLabels setting
    chrome.storage.local.get('showLabels', (result) => {
        showLabelToggle.checked = result.showLabels !== false;
    });

    showLabelToggle.addEventListener('change', function () {
        const showLabels = showLabelToggle.checked;
        chrome.storage.local.set({ showLabels: showLabels }, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleShowLabels', showLabels: showLabels });
            });
        });
    });
}

// Initialize the censor toggle
function initializeCensorToggle() {
    const censorToggle = document.getElementById('censorToggle');

    // Initialize the toggle based on stored settings
    chrome.storage.local.get(['censorEnabled'], function (result) {
        censorToggle.checked = result.censorEnabled !== false;
    });

    censorToggle.addEventListener('change', function () {
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
                chrome.runtime.sendMessage({ type: 'toggleEnabled', status: censorToggle.checked });
            } else {
                console.error('No active tab found');
            }
        });
    });
}

// Check if user profile exists and display appropriate interface
function checkUserProfile() {
    chrome.storage.local.get(['displayName', 'age'], (result) => {
        const chatInterface = document.getElementById('chatInterface');
        const profileForm = document.getElementById('profileForm');

        if (result.displayName && result.age) {
            chatInterface.style.display = 'block'; // Show chat interface
            profileForm.style.display = 'none';
        } else {
            profileForm.style.display = 'block'; // Show the form
            chatInterface.style.display = 'none';
        }
    });

    // Handle form submission
    const submitButton = document.getElementById('submitProfile');
    submitButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default form submission

        const displayName = document.getElementById('displayName').value;
        const age = document.getElementById('age').value;

        // Basic validation
        if (displayName && age) {
            chrome.storage.local.set({ displayName, age }, () => {
                profileForm.style.display = 'none'; // Show chat interface
                chatInterface.style.display = 'block';
            });
        } else {
            alert('Please enter both your name and age.'); // Handle invalid input
        }
    });
}

// // Event listener for "Clear All Data" button
// const clearAllDataButton = document.getElementById('clearAllDataButton');
// clearAllDataButton.addEventListener('click', () => {
//     const confirmClear = confirm('Are you sure you want to clear all data? This action cannot be undone.');
    
//     if (confirmClear) {
//         chrome.storage.local.clear(() => {
//             location.reload(); // Reload the extension popup
//         });
//     }
// });

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

// // Function to load bad words
// function loadBadWords() {
//     chrome.storage.local.get(['badWords'], (result) => {
//         const badWordsTextarea = document.getElementById('badWordsTextarea');
//         badWordsTextarea.value = result.badWords ? result.badWords.join('\n') : '';
//     });
// }

// // Event listener for saving bad words
// const saveBadWordsButton = document.getElementById('saveBadWordsButton');
// saveBadWordsButton.addEventListener('click', saveBadWords);

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
        dotCount = (dotCount % 4) + 1; // Cycle through 1, 2, 3, 4 dots
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

