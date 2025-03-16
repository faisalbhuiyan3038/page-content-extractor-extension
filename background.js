// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'extractArticle',
    title: 'Extract Article Text',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'extractAllText',
    title: 'Extract All Text',
    contexts: ['page']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'extractArticle') {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractAndCopyArticle'
      });
      // No need to handle response, content script handles copying
    } else if (info.menuItemId === 'extractAllText') {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractAndCopyAllText'
      });
      // No need to handle response, content script handles copying
    }
  } catch (error) {
    console.error('Error in context menu handler:', error);
  }
});
