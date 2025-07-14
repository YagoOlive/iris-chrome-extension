// src/background/index.js

const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/index.html';

// A map to hold all active connections from content scripts
const contentScriptPorts = new Map();

let offscreenPort = null;

// --- PORT MANAGEMENT ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'pose') {
    const tabId = port.sender.tab.id;
    contentScriptPorts.set(tabId, port);
    console.log(`Background: Port connected from content script in tab ${tabId}`);
    port.onDisconnect.addListener(() => {
      contentScriptPorts.delete(tabId);
      console.log(`Background: Port from tab ${tabId} disconnected.`);
    });
  } else if (port.name === 'offscreen') {
    offscreenPort = port;
    console.log('Background: Port connected from offscreen document.');
    offscreenPort.onMessage.addListener((landmarks) => {
      console.log("Background: Landmarks received by background script.");
      for (const contentPort of contentScriptPorts.values()) {
        contentPort.postMessage(landmarks);
      }
    });
    port.onDisconnect.addListener(() => {
      offscreenPort = null;
      console.log('Background: Offscreen port disconnected.');
    });
  }
});

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
    // Use a promise to wait for the document to be fully created
    await new Promise((resolve, reject) => {
      chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['USER_MEDIA'],
        justification: 'Required to access the camera for head-tracking.',
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    console.log('Background: Offscreen document created.');
  }
}

// --- NEW ROBUST HELPER ---
async function getOffscreenPort() {
  // 1. Ensure the document is created
  await setupOffscreenDocument();

  // 2. If the port is already connected, return it
  if (offscreenPort) {
    return offscreenPort;
  }

  // 3. If not, wait for it to connect.
  // This promise will resolve when the onConnect listener in this script
  // assigns a value to `offscreenPort`.
  console.log("Background: Waiting for offscreen port to connect...");
  return new Promise((resolve) => {
    const listener = (port) => {
      if (port.name === 'offscreen') {
        chrome.runtime.onConnect.removeListener(listener); // Clean up listener
        resolve(port);
      }
    };
    chrome.runtime.onConnect.addListener(listener);
  });
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
      files: [
        'content/state.js',
        'content/math.js',
        'content/residual.js',
        'content/calibration.js',
        'content/tracker.js'
      ],
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

// 3. On Message: Handle all communication
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    // This listener is now only for one-off messages from the popup
    if (msg.cmd === 'START_TRACKING') {
      // 1. Get a guaranteed connection to the offscreen port
      const port = await getOffscreenPort();

      // 2. Send the command to start the camera
      port.postMessage({ cmd: 'START_CAMERA' });

      // 3. Save state and inject content scripts
      const toSet = { isTrackingActive: true };
      if (msg.calibrationCsv) toSet.calibrationCsv = msg.calibrationCsv;
      await chrome.storage.local.set(toSet);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) await injectContent(tab.id);
      sendResponse({ ok: true, message: 'Tracking started.' });
    }
    else if (msg.cmd === 'STOP_TRACKING') {
      // 1. Get the port (it should already exist) and send the stop command
      const port = await getOffscreenPort();
      port.postMessage({ cmd: 'STOP_CAMERA' });

      // 2. Update state and remove content scripts
      await chrome.storage.local.set({ isTrackingActive: false });
      const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
      for (const tab of tabs) await removeContent(tab.id);
      sendResponse({ ok: true, message: 'Tracking stopped.' });
    }
  })();
  return true;
});