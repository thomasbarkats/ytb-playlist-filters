const WATCH_LATER_URL = 'https://www.youtube.com/playlist?list=WL';

chrome.action.onClicked.addListener((tab) => {
  if (tab.url && /^https?:\/\/([^/]+\.)?youtube\.com\//.test(tab.url)) {
    return;
  }
  chrome.tabs.create({ url: WATCH_LATER_URL });
});
