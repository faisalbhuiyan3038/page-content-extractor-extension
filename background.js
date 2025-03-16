// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Create context menu items only if supported
browserAPI.runtime.onInstalled.addListener(() => {
  // Check if context menus are supported
  if (browserAPI.contextMenus) {
    browserAPI.contextMenus.create({
      id: 'extractArticle',
      title: 'Extract Article Text',
      contexts: ['page']
    });

    browserAPI.contextMenus.create({
      id: 'extractAllText',
      title: 'Extract All Text',
      contexts: ['page']
    });

    browserAPI.contextMenus.create({
      id: 'copyYoutubeTranscript',
      title: 'Copy YouTube Transcript',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.youtube.com/*']
    });

    // Handle context menu click
    browserAPI.contextMenus.onClicked.addListener(async (info, tab) => {
      try {
        if (info.menuItemId === 'extractArticle') {
          const response = await browserAPI.tabs.sendMessage(tab.id, {
            action: 'extractAndCopyArticle'
          });
        } else if (info.menuItemId === 'extractAllText') {
          const response = await browserAPI.tabs.sendMessage(tab.id, {
            action: 'extractAndCopyAllText'
          });
        } else if (info.menuItemId === 'copyYoutubeTranscript') {
          const response = await browserAPI.tabs.sendMessage(tab.id, {
            action: 'copyYoutubeTranscript'
          });
        }
      } catch (error) {
        console.error('Error in context menu handler:', error);
      }
    });
  }
});
