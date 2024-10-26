// Get DOM elements
const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.querySelector('.chat-input input');
const sendButton = document.querySelector('.send-button');
const clearChatButton = document.getElementById('clearChatButton');
const attachImageButton = document.getElementById('attachImageButton');
const imageUpload = document.getElementById('imageUpload');
const socket = io('http://localhost:3000');
// Function to load chat messages from storage
function loadChatMessages() {
    //console log all storage local
    chrome.storage.local.get(['chatMessages'], (result) => {
        if (result.chatMessages) {
            console.log(result)
            chatMessages.innerHTML = ''; // Clear existing messages
            result.chatMessages.forEach(message => {
                addMessage(message.text, message.sender, message.imageData);
            });
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
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

// Function to handle image selection
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Send image data to server (and other clients)
            socket.emit('chat message', {
                text: chatInput.value, // Include any text message
                imageData: e.target.result
            });
            addMessage('You sent an image', 'user', e.target.result); // Add to sender's UI
            chatInput.value = ''; // Clear text input
            saveChatMessages(); // Save messages after sending
        };
        reader.readAsDataURL(file);
    }
}

// Event listeners
sendButton.addEventListener('click', () => {
    sendMessage();
    saveChatMessages(); // Save messages after sending
});

chatInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
        saveChatMessages(); // Save messages after sending
    }
});

clearChatButton.addEventListener('click', clearChat);

// attachImageButton.addEventListener('click', () => {
//     imageUpload.click(); // Trigger the hidden file input
// });

// imageUpload.addEventListener('change', handleImageUpload);



// Receive message (including potential image data)
socket.on('chat message', (data) => {
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
        if (data.imgUrl) {
            const imageElement = document.createElement('img');
            imageElement.src = data.imgUrl;
            imageElement.classList.add('image-preview');
            lastMessageElement.innerHTML = ''; // Clear the placeholder content
            lastMessageElement.appendChild(imageElement);
        } else {
            lastMessageElement.textContent = data.text; // Update text content
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
        saveChatMessages(); // Save messages after receiving
    }, 700); // Adjust delay as needed


});
// Function to send the message
function sendMessage() {
    const messageText = chatInput.value.trim();
    const messageData = {}; // Start with an empty object

    // Determine message type
    if (imageUpload.files.length > 0 && messageText !== "") {
        messageData.type = 'text_image'; // Both text and image
    } else if (imageUpload.files.length > 0) {
        messageData.type = 'image'; // Image only
    } else {
        messageData.type = 'text'; // Text only
    }

    // Add text content (if any)
    if (messageText !== "") {
        messageData.text = messageText;
    }

    // Handle image upload (if any)
    if (imageUpload.files.length > 0) {
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
}

// Function to send the message to the server
function sendMessageToServer(messageData) {
    sendPayload(messageData);
    addMessage('You', 'user', messageData);
    chatInput.value = '';
    imageUpload.value = ''; // Clear the file input
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

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

    } catch (error) {
        console.error('Error sending message:', error);
        // Handle the error, e.g., display an error message to the user
        // addMessage('Error sending message. Please try again later.', 'server');
    } finally {
        // Clear input fields
        chatInput.value = '';
        imageUpload.value = '';
    }

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

document.addEventListener('DOMContentLoaded', function () {
    const censorToggle = document.getElementById('censorToggle');

    // Initialize the toggle based on stored settings
    chrome.storage.local.get(['censorEnabled'], function (result) {
        censorToggle.checked = result.censorEnabled !== false;
    });

    censorToggle.addEventListener('change', function () {
        if (censorToggle.checked) {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                var activeTab = tabs[0];
                chrome.tabs.sendMessage(activeTab.id, { action: 'enableCensor' }, function (response) {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError)
                        console.error('Error sending message to content script:', chrome.runtime.lastError);
                    } else {
                        console.log('Censor enabled');
                    }
                });
            });
            chrome.storage.local.set({ censorEnabled: true });
        } else {
            chrome.runtime.sendMessage({ action: 'disableCensor' });
            chrome.storage.local.set({ censorEnabled: false });
        }
    });
});