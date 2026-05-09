const messagesContainer = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const voiceButton = document.getElementById('voiceButton');
const clearChatButton = document.querySelector('.clear-chat-button');
const newConversationButton = document.querySelector('.new-conversation-button');
const historyToggleButton = document.querySelector('.history-toggle-button');
const historyClose = document.querySelector('.history-close');
const conversationHistory = document.querySelector('.conversation-history');
const historyOverlay = document.getElementById('historyOverlay');
const conversationList = document.getElementById('conversationList');
const themeToggleButton = document.querySelector('.theme-toggle-button');
const languageToggle = document.getElementById('languageToggle');
const mobileMenuButton = document.querySelector('.mobile-menu-button');
const sidebar = document.querySelector('.sidebar');
const mobileOverlay = document.getElementById('mobileOverlay');
const mobileLanguageWrapper = document.querySelector('.mobile-language-toggle');

let selectedLanguage = 'en';
let currentTheme = 'day';
let typingIndicator = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let mediaStream = null;
let conversations = [];
let currentConversationId = null;

function getTimestamp() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

function createWelcomeMessage() {
  const welcomeBox = document.createElement('div');
  welcomeBox.className = 'welcome-box';
  welcomeBox.textContent = 'Hello! I am AgriBotGH. Ask me any farming question in English or Twi and I will help you.';
  messagesContainer.appendChild(welcomeBox);
  scrollToBottom();
}

function appendMessage({ text, type, skipAddToHistory }) {
  const messageCard = document.createElement('div');
  messageCard.className = `message-card ${type}-message`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (type === 'bot') {
    const icon = document.createElement('span');
    icon.className = 'message-icon';
    icon.textContent = '🤖';
    bubble.appendChild(icon);
  }

  const messageText = document.createElement('span');
  messageText.textContent = text;
  bubble.appendChild(messageText);
  messageCard.appendChild(bubble);

  const timestamp = document.createElement('div');
  timestamp.className = 'message-timestamp';
  if (type === 'user') {
    timestamp.classList.add('right');
  }
  timestamp.textContent = getTimestamp();
  messageCard.appendChild(timestamp);

  messagesContainer.appendChild(messageCard);
  
  if (!skipAddToHistory) {
    addMessageToCurrentConversation(text, type);
  }
  
  scrollToBottom();
}

function showTypingIndicator() {
  typingIndicator = document.createElement('div');
  typingIndicator.className = 'message-card typing-indicator';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  dots.innerHTML = '<span>●</span><span>●</span><span>●</span>';
  bubble.appendChild(dots);
  typingIndicator.appendChild(bubble);
  messagesContainer.appendChild(typingIndicator);
  scrollToBottom();
}

function hideTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.remove();
    typingIndicator = null;
  }
}

function clearChat() {
  messagesContainer.innerHTML = '';
  chatInput.value = '';
  createNewConversation();
  createWelcomeMessage();
  chatInput.focus();
  renderConversationHistory();
}

function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage({ text, type: 'user' });
  chatInput.value = '';
  chatInput.focus();
  showTypingIndicator();

  setTimeout(() => {
    hideTypingIndicator();
    appendMessage({
      text: 'Thank you for your question! Our AI is processing your request. (Backend integration pending.)',
      type: 'bot'
    });
  }, 1500);
}

async function sendToBackend(message, language) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, language })
    });
    const data = await response.json();
    return data.response;
  } catch (error) {
    return 'Sorry, the backend is unavailable right now. Please try again later.';
  }
}

function setLanguage(lang) {
  selectedLanguage = lang;
  const buttons = document.querySelectorAll('.lang-button');
  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === lang);
  });
  const mobileButtons = document.querySelectorAll('.mobile-language-toggle .lang-button');
  mobileButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === lang);
  });
}

function setupLanguageToggle() {
  const buttons = document.querySelectorAll('.lang-button');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      setLanguage(button.dataset.lang);
    });
  });

  if (mobileLanguageWrapper) {
    const mobileEnglish = document.createElement('button');
    mobileEnglish.type = 'button';
    mobileEnglish.className = 'lang-button active';
    mobileEnglish.dataset.lang = 'en';
    mobileEnglish.textContent = 'English';

    const mobileTwi = document.createElement('button');
    mobileTwi.type = 'button';
    mobileTwi.className = 'lang-button';
    mobileTwi.dataset.lang = 'tw';
    mobileTwi.textContent = 'Twi';

    [mobileEnglish, mobileTwi].forEach((button) => {
      button.addEventListener('click', () => {
        setLanguage(button.dataset.lang);
      });
      mobileLanguageWrapper.appendChild(button);
    });
  }
}

function setupQuickChips() {
  const chips = document.querySelectorAll('.chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chatInput.value = chip.textContent;
      chatInput.focus();
    });
  });
}

function setupMobileSidebar() {
  mobileMenuButton.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
    const isOpen = sidebar.classList.contains('mobile-open');
    mobileOverlay.style.display = isOpen ? 'block' : 'none';
  });

  mobileOverlay.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    mobileOverlay.style.display = 'none';
  });
}

async function startVoiceRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    mediaRecorder = new MediaRecorder(mediaStream);
    audioChunks = [];
    isRecording = true;
    voiceButton.classList.add('recording');
    voiceButton.innerHTML = '⏹';

    mediaRecorder.onstart = () => {
      voiceButton.setAttribute('aria-label', 'Stop recording');
    };

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
      handleVoiceRecorded(audioBlob);
      isRecording = false;
      voiceButton.classList.remove('recording');
      voiceButton.innerHTML = '<svg class="voice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1c-1.657 0-3 1.343-3 3v7c0 1.657 1.343 3 3 3s3-1.343 3-3V4c0-1.657-1.343-3-3-3z"/><path d="M19 10c0 3.314-2.686 6-6 6s-6-2.686-6-6"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
      voiceButton.setAttribute('aria-label', 'Record voice message');
      mediaStream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
  } catch (error) {
    console.error('Error accessing microphone:', error);
    alert('Unable to access microphone. Please check permissions.');
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function handleVoiceRecorded(audioBlob) {
  const audioUrl = URL.createObjectURL(audioBlob);
  const timestamp = getTimestamp();

  const messageCard = document.createElement('div');
  messageCard.className = 'message-card user-message';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const audioElement = document.createElement('audio');
  audioElement.controls = true;
  audioElement.style.maxWidth = '200px';
  audioElement.src = audioUrl;
  bubble.appendChild(audioElement);

  messageCard.appendChild(bubble);

  const timeEl = document.createElement('div');
  timeEl.className = 'message-timestamp right';
  timeEl.textContent = timestamp;
  messageCard.appendChild(timeEl);

  messagesContainer.appendChild(messageCard);
  scrollToBottom();

  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    appendMessage({
      text: 'Thank you for your voice message! Our AI is processing your request. (Backend integration pending.)',
      type: 'bot'
    });
  }, 1500);
}

function applyTheme(theme) {
  currentTheme = theme;
  document.body.dataset.theme = theme;
  if (themeToggleButton) {
    themeToggleButton.textContent = theme === 'day' ? '🌙' : '☀️';
    themeToggleButton.setAttribute('aria-label', theme === 'day' ? 'Switch to night theme' : 'Switch to day theme');
  }
}

function toggleTheme() {
  applyTheme(currentTheme === 'day' ? 'night' : 'day');
}

function createNewConversation() {
  const conversationId = Date.now();
  const conversation = {
    id: conversationId,
    messages: [],
    title: 'New Conversation',
    timestamp: new Date()
  };
  conversations.unshift(conversation);
  currentConversationId = conversationId;
  renderConversationHistory();
  return conversationId;
}

function addMessageToCurrentConversation(text, type) {
  if (!currentConversationId) {
    createNewConversation();
  }
  const conv = conversations.find(c => c.id === currentConversationId);
  if (conv) {
    conv.messages.push({ text, type, timestamp: new Date() });
    if (conv.messages.length === 1 && type === 'user') {
      conv.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
    }
  }
}

function renderConversationHistory() {
  if (conversations.length === 0) {
    conversationList.innerHTML = '<p class="empty-state">No conversations yet</p>';
    return;
  }

  conversationList.innerHTML = '';
  conversations.forEach((conv) => {
    const item = document.createElement('div');
    item.className = `conversation-item${conv.id === currentConversationId ? ' active' : ''}`;
    item.innerHTML = `
      <div class="conversation-title">${conv.title}</div>
      <div class="conversation-time">${formatTime(conv.timestamp)}</div>
    `;
    item.addEventListener('click', () => loadConversation(conv.id));
    conversationList.appendChild(item);
  });
}

function loadConversation(conversationId) {
  const conv = conversations.find(c => c.id === conversationId);
  if (!conv) return;

  currentConversationId = conversationId;
  messagesContainer.innerHTML = '';
  
  if (conv.messages.length === 0) {
    createWelcomeMessage();
  } else {
    conv.messages.forEach((msg) => {
      appendMessage({ text: msg.text, type: msg.type, skipAddToHistory: true });
    });
  }

  renderConversationHistory();
  closeHistoryPanel();
  scrollToBottom();
}

function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toggleHistoryPanel() {
  conversationHistory.classList.toggle('open');
  historyOverlay.classList.toggle('open');
}

function closeHistoryPanel() {
  conversationHistory.classList.remove('open');
  historyOverlay.classList.remove('open');
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

sendButton.addEventListener('click', handleSend);
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSend();
  }
});
clearChatButton.addEventListener('click', clearChat);
newConversationButton.addEventListener('click', clearChat);
historyToggleButton.addEventListener('click', toggleHistoryPanel);
historyClose.addEventListener('click', closeHistoryPanel);
historyOverlay.addEventListener('click', closeHistoryPanel);
voiceButton.addEventListener('click', () => {
  if (!isRecording) {
    startVoiceRecording();
  } else {
    stopVoiceRecording();
  }
});
if (themeToggleButton) {
  themeToggleButton.addEventListener('click', toggleTheme);
}

setupLanguageToggle();
setupQuickChips();
setupMobileSidebar();
applyTheme('day');
clearChat();
