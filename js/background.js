// Background service worker for Glass AI Note Taker

chrome.commands.onCommand.addListener((command) => {
  if (command === "store-link") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.url) {
        storeLink(activeTab.url, activeTab.title);
      }
    });
  }
});

function storeLink(url, title) {
  chrome.storage.local.get(['stored_links'], (result) => {
    const links = result.stored_links || [];
    const newLink = {
      url: url,
      title: title,
      timestamp: Date.now()
    };
    
    links.unshift(newLink); // Add to beginning
    chrome.storage.local.set({ 'stored_links': links }, () => {
      console.log('Link stored:', url);
      
      // Optional: Visual feedback (badge)
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#A855F7' }); // Purple accent
      
      // Clear badge after 3 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 3000);
    });
  });
}
