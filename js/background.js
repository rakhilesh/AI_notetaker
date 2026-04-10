// Background service worker for Glass AI Note Taker

chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked. Opening index.html...");
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") }, (newTab) => {
    if (chrome.runtime.lastError) {
      console.error("Error opening tab:", chrome.runtime.lastError);
    } else {
      console.log("Tab opened successfully:", newTab.id);
    }
  });
});

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
