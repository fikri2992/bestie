// Get DOM elements
const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.querySelector('.chat-input input');
const sendButton = document.querySelector('.chat-input button');

// Function to add a new message to the chat
function addMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
}
// Event listener for send button click
sendButton.addEventListener('click', sendMessage);

// Event listener for Enter key press
chatInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Function to send the message
function sendMessage() {
    const message = chatInput.value.trim();
    if (message !== "") {
        addMessage(message, 'user'); // Add user message

        // TODO: Implement logic to send message and handle responses

        chatInput.value = ""; // Clear input field
    }
}


// Tab switching logic
const tabs = document.querySelectorAll('.tab');
const contentAreas = document.querySelectorAll('.content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and content areas
        tabs.forEach(t => t.classList.remove('active'));
        contentAreas.forEach(area => area.classList.remove('active'));

        // Add active class to clicked tab and corresponding content area
        const targetId = tab.dataset.target;
        tab.classList.add('active');
        document.getElementById(targetId).classList.add('active');
    });
});
