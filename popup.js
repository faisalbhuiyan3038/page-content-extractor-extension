document.addEventListener('DOMContentLoaded', async () => {
  // Check if current page is YouTube
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isYouTube = tab.url.includes('youtube.com/watch');
  document.getElementById('youtubeSection').style.display = isYouTube ? 'block' : 'none';

  // If on YouTube, load available languages
  if (isYouTube) {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAvailableLanguages' });
    const languageSelect = document.getElementById('languageSelect');
    languageSelect.innerHTML = ''; // Clear loading option

    // Add English as first option
    const enOption = document.createElement('option');
    enOption.value = 'en';
    enOption.textContent = 'English';
    languageSelect.appendChild(enOption);

    // Add all other languages
    if (response.languages) {
      response.languages.forEach(lang => {
        if (lang.code !== 'en') { // Skip English as it's already added
          const option = document.createElement('option');
          option.value = lang.code;
          option.textContent = lang.name;
          languageSelect.appendChild(option);
        }
      });
    }

    // Set default language
    chrome.storage.local.get(['defaultLanguage'], function (result) {
      if (result.defaultLanguage) {
        languageSelect.value = result.defaultLanguage;
      }
    });

    // Save selected language as default
    languageSelect.addEventListener('change', function () {
      chrome.storage.local.set({ 'defaultLanguage': this.value });
    });
  }

  document.getElementById('viewArticle').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    openTextInNewTab(response.text);
  });

  document.getElementById('copyArticle').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    await copyToClipboard(tab.id, response.text);
  });

  document.getElementById('viewAllText').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractAllText' });
    openTextInNewTab(response.text);
  });

  document.getElementById('copyAllText').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractAllText' });
    await copyToClipboard(tab.id, response.text);
  });

  document.getElementById('copyTranscript').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const language = document.getElementById('languageSelect').value;
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getYoutubeTranscript',
      language: language
    });
    if (response.transcript) {
      try {
        await navigator.clipboard.writeText(response.transcript);
        chrome.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: 'Content copied to clipboard!'
        });
      } catch (error) {
        // If clipboard write fails in popup, try copying in the content script
        chrome.tabs.sendMessage(tab.id, {
          action: 'copyYoutubeTranscript',
          language: language,
          fallback: true
        });
      }
    } else {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'No transcript available for this video'
      });
    }
  });
});

function openTextInNewTab(text) {
  chrome.tabs.create({
    url: `data:text/html,<pre style="white-space: pre-wrap; font-family: sans-serif; padding: 20px;">${encodeURIComponent(text)}</pre>`
  });
}

async function copyToClipboard(tabId, text) {
  try {
    await navigator.clipboard.writeText(text);
    // Send message to content script to show notification
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: 'Content copied to clipboard!'
    });
  } catch (error) {
    // If clipboard write fails in popup, send back to content script to copy
    chrome.tabs.sendMessage(tabId, {
      action: 'copyText',
      text: text
    });
  }
}
