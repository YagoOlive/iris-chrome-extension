// src/background/index.js

// src/background/index.js

const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/index.html';

// --- HELPERS ---

// A helper to check if an offscreen document is already active
async function hasOffscreenDocument() {
  const matchedClients = await clients.matchAll();
  return matchedClients.some(
    (c) => c.url.endsWith(OFFSCREEN_DOCUMENT_PATH)
  );
}

// The main function to create the offscreen document
async function setupOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    console.log('Background: Offscreen document already exists.');
  } else {
    console.log('Background: Creating offscreen document.');
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['USER_MEDIA'],
      justification: 'Required to access the camera for head-tracking.',
    });
  }
}

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
      // 1. Start the persistent camera stream via the offscreen document
      await setupOffscreenDocument();
      await chrome.runtime.sendMessage({ cmd: 'START_CAMERA', target: 'offscreen' });

      // 2. Save state and inject content scripts
      const toSet = { isTrackingActive: true };
      if (msg.calibrationCsv) {
        toSet.calibrationCsv = msg.calibrationCsv;
      }
      await chrome.storage.local.set(toSet);
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await injectContent(tab.id);
      }
      sendResponse({ ok: true, message: 'Tracking started.' });
    } 
    else if (msg.cmd === 'STOP_TRACKING') {
      // 1. Stop the persistent camera stream
      await chrome.runtime.sendMessage({ cmd: 'STOP_CAMERA', target: 'offscreen' });

      // 2. Update state and remove content scripts
      await chrome.storage.local.set({ isTrackingActive: false });
      const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
      for (const tab of tabs) {
        await removeContent(tab.id);
      }
      sendResponse({ ok: true, message: 'Tracking stopped and content removed.' });
    }
  })();
  return true;
});