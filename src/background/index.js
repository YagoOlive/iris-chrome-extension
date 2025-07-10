// src/background/index.js

// --- HELPERS ---

// Injects the content scripts and CSS into a specific tab
async function injectContent(tabId) {
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
    console.error(`Failed to inject content into tab ${tabId}:`, err);
  }
}

// Removes the CSS and tells the content script to clean up
async function removeContent(tabId) {
  try {
    await chrome.scripting.removeCSS({
      target: { tabId: tabId },
      files: ['content/cursor.css'],
    });
    // The content script might not be there (e.g., on chrome:// pages), so wrap in try/catch
    await chrome.tabs.sendMessage(tabId, { cmd: 'STOP_TRACKING' });
  } catch (err) {
    // This error is expected on pages where the content script is not injected.
    // console.log(`Could not clean up tab ${tabId}, it might not have the content script.`);
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
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('file'))) {
    const { isTrackingActive } = await chrome.storage.local.get('isTrackingActive');
    if (isTrackingActive) {
      console.log(`Tracking is active. Injecting content into tab ${tabId}`);
      await injectContent(tabId);
    }
  }
});

// 3. On Message: Handle communication from the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.cmd === 'GET_STATUS') {
      const data = await chrome.storage.local.get(['isTrackingActive', 'calibrationCsv']);
      sendResponse(data);
    } 
    else if (msg.cmd === 'START_TRACKING') {
      await chrome.storage.local.set({
        isTrackingActive: true,
        calibrationCsv: msg.calibrationCsv,
      });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await injectContent(tab.id);
      }
      sendResponse({ ok: true, message: 'Tracking started.' });
    } 
    else if (msg.cmd === 'STOP_TRACKING') {
      await chrome.storage.local.set({ isTrackingActive: false });
      // Loop through all tabs and remove the content
      const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
      for (const tab of tabs) {
        await removeContent(tab.id);
      }
      sendResponse({ ok: true, message: 'Tracking stopped and content removed.' });
    }
  })();
  return true;
});