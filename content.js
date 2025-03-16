chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractArticle' || request.action === 'extractAndCopyArticle') {
    const text = extractArticleText();
    if (request.action === 'extractAndCopyArticle') {
      copyAndNotify(text);
      sendResponse({ success: true });
    } else {
      sendResponse({ text });
    }
  } else if (request.action === 'extractAllText' || request.action === 'extractAndCopyAllText') {
    const text = extractAllText();
    if (request.action === 'extractAndCopyAllText') {
      copyAndNotify(text);
      sendResponse({ success: true });
    } else {
      sendResponse({ text });
    }
  } else if (request.action === 'showNotification') {
    showNotification(request.message);
    sendResponse({ success: true });
  }
  return true;
});

function extractArticleText() {
  const documentClone = document.cloneNode(true);
  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (article) {
    return `Title: ${article.title}\n\n${article.textContent}`.replace(/[\r\n]{3,}/g, '\n\n').trim();
  }
  return extractAllText(); // Fallback to all text if article parsing fails
}

function extractAllText() {
  // Remove hidden elements
  const elements = document.querySelectorAll('body *');
  const visibleElements = Array.from(elements).filter(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  });

  // Extract text from visible elements
  let text = '';
  visibleElements.forEach(el => {
    if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3') {
      text += `\n### ${el.innerText.trim()} ###\n`;
    } else if (el.tagName === 'P' || el.tagName === 'DIV' || el.tagName === 'SPAN') {
      const content = el.innerText.trim();
      if (content) text += content + '\n';
    }
  });

  // Clean up the text
  return text
    .replace(/[\r\n]{3,}/g, '\n\n')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();
}

function copyAndNotify(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Content copied to clipboard!');
  });
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 16px;
    border-radius: 4px;
    z-index: 9999;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}
