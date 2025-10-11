// Twitter Warmer Background Script
console.log('Twitter Warmer: Background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitter Warmer: Extension installed');
  
  // Initialize storage
  chrome.storage.local.set({
    isRunning: false,
    totalLikes: 0,
    totalScrolls: 0
  });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    // Update statistics
    chrome.storage.local.get(['totalLikes', 'totalScrolls'], (result) => {
      const updates = {};
      
      if (request.type === 'like') {
        updates.totalLikes = (result.totalLikes || 0) + 1;
      } else if (request.type === 'scroll') {
        updates.totalScrolls = (result.totalScrolls || 0) + 1;
      }
      
      chrome.storage.local.set(updates);
    });
  }
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('twitter.com') || tab.url.includes('x.com')) {
      console.log('Twitter Warmer: Twitter tab detected');
    }
  }
});