// src/background/index.js

import calibrationScript from '../content/calibration.js?script';
import mathScript from '../content/math.js?script';
import residualScript from '../content/residual.js?script';
import stateScript from '../content/state.js?script';
import trackerScript from '../content/tracker.js?script';


const OFFSCREEN_DOCUMENT_PATH = chrome.runtime.getURL('src/offscreen/index.html');

// A map to hold all active connections from content scripts
const contentScriptPorts = new Map();

let offscreenPort = null;
let activeTabId = null;

// --- PORT MANAGEMENT ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'pose') {
    const tabId = port.sender.tab.id;
    contentScriptPorts.set(tabId, port);
    if (!activeTabId) activeTabId = tabId;
    console.log(`Background: Port connected from content script in tab ${tabId}`);
    port.onDisconnect.addListener(() => {
      contentScriptPorts.delete(tabId);
      console.log(`Background: Port from tab ${tabId} disconnected.`);
    });
  } else if (port.name === 'offscreen') {
    offscreenPort = port;
    console.log('Background: Port connected from offscreen document.');
    offscreenPort.onMessage.addListener((packet) => { // packet = { landmarks, blends }

      console.log("Background: Landmarks and facial expressions received by background script.");

      // send only to the currently-active tab
      if (!activeTabId) return; // Nothing is focused

      // try to get an existing port
      let targetPort = contentScriptPorts.get(activeTabId);

      for (const contentPort of contentScriptPorts.values()) {
        if (contentPort === targetPort) {
          contentPort.postMessage(packet);
          continue;
        }
        contentPort.postMessage({ landmarks: packet.landmarks });
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
        stateScript,
        mathScript,
        residualScript,
        calibrationScript,
        trackerScript,
      ],
    });
  } catch (err) {
    console.error(`Failed to inject content into tab ${tabId}:`, err);
  }
}

// utility: ensure the script is present *once* and return true if it was already there
async function ensureContent(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { cmd: 'PING' });
    if (res?.ok) return true; // already injected
  } catch { /* no listener */ }
  await injectContent(tabId); // first time for this frame
  return false;
}

// Removes the CSS and tells the content script to clean up
async function removeContent(tabId) {
  try {
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

// 3. Active Tab Tracking: automatic injection on active tabs
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  activeTabId = tabId;
  const { isTrackingActive } = await chrome.storage.local.get('isTrackingActive');
  if (isTrackingActive && !contentScriptPorts.has(tabId)) {
    console.log(`Tracking is active. Injecting content into active tab ${tabId}`);
    const check = await ensureContent(tabId); // inject only once
    if (check) {
      const { calibrationCsvContent } = await chrome.storage.local.get('calibrationCsvContent')
      await chrome.tabs.sendMessage(tabId, {
        cmd: 'START_TRACKING',
        calibrationCsvContent: calibrationCsvContent,
      });
    }
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activeTabId = null; // browser lost focus
    return;
  }
  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs.length) activeTabId = tabs[0].id;
  });
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
      if (msg.calibrationCsvName) toSet.calibrationCsvName = msg.calibrationCsvName;
      if (msg.calibrationCsvContent) toSet.calibrationCsvContent = msg.calibrationCsvContent;
      await chrome.storage.local.set(toSet);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const check = await ensureContent(tab.id); // inject only once
        if (check) {
          await chrome.tabs.sendMessage(tab.id, {
            cmd: 'START_TRACKING',
            calibrationCsvContent: msg.calibrationCsvContent,
          });
        }
      }
      sendResponse({ ok: true, message: 'Tracking started.' });
    }
    else if (msg.cmd === 'STOP_TRACKING') {
      // 1. Get the port (it should already exist) and send the stop command
      if (offscreenPort) offscreenPort.postMessage({ cmd: 'STOP_CAMERA' });
      try {
        await chrome.offscreen.closeDocument();
      }
      catch (e) {
        console.warn('Offscreen document already closed.', e);
      }
      offscreenPort = null;

      // 2. Update state and remove content scripts
      await chrome.storage.local.set({ isTrackingActive: false });
      const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
      for (const tab of tabs) await removeContent(tab.id);
      sendResponse({ ok: true, message: 'Tracking stopped.' });
    }
    else if (msg.cmd === 'UPDATE_SETTINGS') {
      console.log('Updating Settings...');

      for (const setting in msg) {
        if (setting === 'cmd') {
          continue;
        }
        // 1. Persist for future tabs
        await chrome.storage.local.set({
          [setting]: msg[setting],
        });

        // 2. Broadcast via chrome.tabs.sendMessage
        const tabs = await chrome.tabs.query({
          url: ['http://*/*', 'https://*/*']
        });

        for (const tab of tabs) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              cmd: 'UPDATE_SETTINGS',
              [setting]: msg[setting],
            });
          } catch (e) {
            // Tab has no listener or is non-scriptable; ignore
          }
        }
      }

      return sendResponse({ ok: true, message: 'Settings updated.' });
    }
    else if (msg.cmd === 'CAMERA_RESULT') {
      // 1. Dismiss the permission page first
      if (sender.tab?.id) await chrome.tabs.remove(sender.tab.id);

      const { state } = await navigator.permissions.query({ name: 'camera' });

      if (state !== 'granted') {
        // 2. Remember the outcome
        await chrome.storage.local.set({ autoEnableCamera: state });
      }

      // 3. Re-open the popup while the user-gesture is still valid
      await chrome.action.openPopup();
    }

  })();
  return true;
});