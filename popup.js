document.addEventListener('DOMContentLoaded', () => {
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
});

function openTextInNewTab(text) {
  chrome.tabs.create({
    url: `data:text/html,<pre style="white-space: pre-wrap; font-family: sans-serif; padding: 20px;">${encodeURIComponent(text)}</pre>`
  });
}

async function copyToClipboard(tabId, text) {
  await navigator.clipboard.writeText(text);
  // Send message to content script to show notification
  chrome.tabs.sendMessage(tabId, {
    action: 'showNotification',
    message: 'Content copied to clipboard!'
  });
}
