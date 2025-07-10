// src/background/index.js

// --- HELPERS ---

// Injects the content scripts into a specific tab
async function injectScripts(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['content/cursor.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/tracker.js'],
    });
  } catch (err) {
    console.error('Failed to inject scripts:', err);
  }
}

// Removes the cursor from all tabs by sending a message to content scripts
async function removeCursorFromAllTabs() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_TRACKING' });
    } catch (e) {
      // This will throw an error if the content script isn't on the page, which is fine.
      // console.log(`Could not send message to tab ${tab.id}, it might not have the content script.`);
    }
  }
}


// --- LISTENERS ---

// 1. On Install: Set up the initial state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isTrackingActive: false,
    calibrationCsv: null,
  });
  console.log('Extension installed. Initial state set.');
});

// 2. On Tab Update: The core logic for automatic injection
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Inject only when the page is fully loaded and has a valid URL
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file'))) {
    const { isTrackingActive } = await chrome.storage.local.get('isTrackingActive');
    if (isTrackingActive) {
      console.log(`Tracking is active. Injecting scripts into tab ${tabId}`);
      await injectScripts(tabId);
    }
  }
});

// 3. On Message: Handle communication from the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Keep the message port open for async operations
  (async () => {
    if (msg.cmd === 'GET_STATUS') {
      const data = await chrome.storage.local.get(['isTrackingActive', 'calibrationCsv']);
      sendResponse(data);
    } 
    else if (msg.cmd === 'START_TRACKING') {
      // Save the config and activate tracking
      await chrome.storage.local.set({
        isTrackingActive: true,
        calibrationCsv: msg.calibrationCsv,
      });
      // Inject into the current tab immediately
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await injectScripts(tab.id);
      }
      sendResponse({ ok: true, message: 'Tracking started.' });
    } 
    else if (msg.cmd === 'STOP_TRACKING') {
      await chrome.storage.local.set({ isTrackingActive: false });
      await removeCursorFromAllTabs();
      sendResponse({ ok: true, message: 'Tracking stopped.' });
    }
  })();
  return true; // Required for async sendResponse
});