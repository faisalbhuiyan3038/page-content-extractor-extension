// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Detect if running on mobile
const isMobile = /Android|Mobile|iPhone|iPad/i.test(navigator.userAgent);

document.addEventListener('DOMContentLoaded', async () => {
  // Check if current page is YouTube
  const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
  const isYouTube = tab.url.includes('youtube.com/watch');
  document.getElementById('youtubeSection').style.display = isYouTube ? 'block' : 'none';

  // If on YouTube, load available languages
  if (isYouTube) {
    const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'getAvailableLanguages' });
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
    browserAPI.storage.local.get(['defaultLanguage'], function (result) {
      if (result.defaultLanguage) {
        languageSelect.value = result.defaultLanguage;
      }
    });

    // Save selected language as default
    languageSelect.addEventListener('change', function () {
      browserAPI.storage.local.set({ 'defaultLanguage': this.value });
    });
  }

  // Add touch event handlers for better mobile interaction
  const addButtonHandler = (buttonId, action) => {
    const button = document.getElementById(buttonId);
    if (isMobile) {
      button.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent double-firing on mobile
        button.click();
      }, { passive: false });
    }
  };

  // Add touch handlers to all buttons
  ['viewArticle', 'copyArticle', 'viewAllText', 'copyAllText', 'copyTranscript'].forEach(id => {
    addButtonHandler(id);
  });

  document.getElementById('viewArticle').addEventListener('click', async () => {
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    try {
      const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'extractArticle' });
      if (response && response.text) {
        if (isMobile) {
          await copyToClipboard(tab.id, response.text);
          window.close();
        } else {
          openTextInNewTab(response.text);
        }
      } else {
        console.error('No text content received');
      }
    } catch (error) {
      console.error('Error extracting article:', error);
    }
  });

  document.getElementById('copyArticle').addEventListener('click', async () => {
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    await copyToClipboard(tab.id, response.text);
  });

  document.getElementById('viewAllText').addEventListener('click', async () => {
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    try {
      const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'extractAllText' });
      if (response && response.text) {
        if (isMobile) {
          // On mobile, copy to clipboard instead of opening new tab
          await copyToClipboard(tab.id, response.text);
          window.close(); // Close popup after copying
        } else {
          openTextInNewTab(response.text);
        }
      } else {
        console.error('No text content received');
      }
    } catch (error) {
      console.error('Error extracting all text:', error);
    }
  });

  document.getElementById('copyAllText').addEventListener('click', async () => {
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const response = await browserAPI.tabs.sendMessage(tab.id, { action: 'extractAllText' });
    await copyToClipboard(tab.id, response.text);
  });

  document.getElementById('copyTranscript').addEventListener('click', async () => {
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const language = document.getElementById('languageSelect').value;
    const response = await browserAPI.tabs.sendMessage(tab.id, {
      action: 'getYoutubeTranscript',
      language: language
    });
    if (response.transcript) {
      try {
        await navigator.clipboard.writeText(response.transcript);
        browserAPI.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: 'Content copied to clipboard!'
        });
      } catch (error) {
        // If clipboard write fails in popup, try copying in the content script
        browserAPI.tabs.sendMessage(tab.id, {
          action: 'copyYoutubeTranscript',
          language: language,
          fallback: true
        });
      }
    } else {
      browserAPI.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'No transcript available for this video'
      });
    }
  });
});

function openTextInNewTab(text) {
  if (!text) {
    console.error('No text provided to open in new tab');
    return;
  }

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Extracted Text</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      background: #f5f5f5;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
      font-family: inherit;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <pre>${text}</pre>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  browserAPI.tabs.create({ url }, (tab) => {
    // Clean up the blob URL after the tab is created
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

async function copyToClipboard(tabId, text) {
  try {
    await navigator.clipboard.writeText(text);
    // Send message to content script to show notification
    browserAPI.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: 'Content copied to clipboard!'
    });
  } catch (error) {
    // If clipboard write fails in popup, send back to content script to copy
    browserAPI.tabs.sendMessage(tabId, {
      action: 'copyText',
      text: text
    });
  }
}
