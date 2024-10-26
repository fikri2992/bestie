// Get DOM elements
const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.querySelector('.chat-input input');
const sendButton = document.querySelector('.chat-input button');
const clearChatButton = document.getElementById('clearChatButton');

// Function to add a new message to the chat
function addMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
}

// Function to load chat messages from storage
function loadChatMessages() {
    chrome.storage.local.get(['chatMessages'], (result) => {
        if (result.chatMessages) {
            chatMessages.innerHTML = ''; // Clear existing messages
            result.chatMessages.forEach(message => {
                addMessage(message.text, message.sender);
            });
        }
    });
}

// Function to save chat messages to storage
function saveChatMessages() {
    const messages = Array.from(chatMessages.children).map(messageElement => ({
        text: messageElement.textContent,
        sender: messageElement.classList.contains('user') ? 'user' : 'server'
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

// Event listener for send button click
sendButton.addEventListener('click', () => {
    sendMessage();
    saveChatMessages(); // Save messages after sending
});

// Event listener for Enter key press
chatInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
        saveChatMessages(); // Save messages after sending
    }
});

// Event listener for clear chat button click
clearChatButton.addEventListener('click', clearChat);

// Load chat messages when the popup opens
loadChatMessages();

// Connect to the Socket.IO server
const socket = io('http://localhost:3000'); // Replace with your server address

// Function to send the message
function sendMessage() {
    const message = chatInput.value.trim();
    if (message !== "") {
        addMessage(message, 'user');

        try {
            // Send the message to the server
            socket.emit('chat message', message);
        } catch (error) {
            console.error('Error sending message:', error);
            // Optionally, display an error message to the user
            addMessage('Error sending message. Please try again later.', 'server', error);
        } finally {
            // Clear input field regardless of success or failure
            chatInput.value = "";
        }
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

// Listen for incoming messages from the server
socket.on('chat message', (msg) => {
    addMessage(msg, 'server');
});