let activeTabId = null;
let currentUrl = null;
let currentTitle = null;
let focusState = { is_active: false, blocked_domains: [] };

// Detect browser type
function getBrowserName() {
  const ua = navigator.userAgent || "";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Brave")) return "Brave";
  return "Chrome";
}

const BROWSER_NAME = getBrowserName();
const NEW_TAB_URL = BROWSER_NAME === "Firefox" ? "about:newtab" : "chrome://newtab/";

// Poll for focus state every 5 seconds
setInterval(() => {
  fetch('http://127.0.0.1:8000/api/focus')
    .then(res => res.json())
    .then(data => { focusState = data; })
    .catch(() => {});
}, 5000);

function sendActivity(url, domain, title) {
  // Check focus mode blocking
  if (focusState.is_active && focusState.blocked_domains.some(blocked => domain.includes(blocked))) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, {url: NEW_TAB_URL});
      }
    });
    return;
  }

  fetch('http://127.0.0.1:8000/api/track/browser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: url || "",
      domain: domain,
      title: title,
      browser: BROWSER_NAME
    })
  }).catch(() => {});
}

function isTrackableUrl(url) {
  return Boolean(
    url &&
    !url.startsWith('chrome://') &&
    !url.startsWith('about:') &&
    !url.startsWith('moz-extension://') &&
    !url.startsWith('chrome-extension://')
  );
}

function trackTab(tab) {
  if (!tab || !isTrackableUrl(tab.url)) return;
  try {
    activeTabId = tab.id;
    currentUrl = tab.url;
    currentTitle = tab.title || "";
    const domain = new URL(tab.url).hostname;
    sendActivity(currentUrl, domain, currentTitle);
  } catch(e) {}
}

function trackActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs && tabs.length > 0) {
      trackTab(tabs[0]);
    }
  });
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  try {
    chrome.tabs.get(activeTabId, trackTab);
  } catch(e) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && (changeInfo.url || changeInfo.title || changeInfo.status === 'complete')) {
    trackTab(tab);
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  trackActiveTab();
});

// Firefox temporary add-ons can be loaded while a tab is already open.
// Send a steady heartbeat so the desktop app knows the extension is alive.
trackActiveTab();
setInterval(trackActiveTab, 10000);
