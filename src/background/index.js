// src/background/index.js

import { injectContent, ensureContent } from './inject.js';
import { getOffscreenPort, getOffscreenPortRef, setOffscreenPortRef, closeOffscreenIfAny } from './offscreen.js';
import {
  handleTABSTRIP_ACTIVATE,
  handleTABSTRIP_CLOSE,
  handleTABSTRIP_NAV,
  handleTABSTRIP_NEW_TAB,
  handleTABSTRIP_OPEN_URL,
  handleTABSTRIP_QUERY,
  createNewTab,
  keysToClear,
  clearKeys,
} from './tabstrip.js';

// A map to hold all active connections from content scripts
const contentScriptPorts = new Map();

let activeTabId = null;

// --- PORT MANAGEMENT ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'pose') {
    const tabId = port.sender.tab.id;
    contentScriptPorts.set(tabId, port);
    if (!activeTabId) activeTabId = tabId;
    console.log(`Background: Port connected from content script in tab ${tabId}`);
    port.onDisconnect.addListener(() => {
      // Only delete if this is the currently-tracked port for the tab.
      if (contentScriptPorts.get(tabId) === port) {
        contentScriptPorts.delete(tabId);
        console.log(`Background: Port from tab ${tabId} disconnected (current).`);
      } else {
        console.log(`Background: Ignored stale disconnect from older port for tab ${tabId}.`);
      }
    });
  } else if (port.name === 'offscreen') {
    setOffscreenPortRef(port);
    console.log('Background: Port connected from offscreen document.');
    port.onMessage.addListener((packet) => {
      // packet = { landmarks, blends }
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
      setOffscreenPortRef(null);
      console.log('Background: Offscreen port disconnected.');
    });
  }
});

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
  if (isTrackingActive) {
    console.log(`Tracking is active. Injecting content into active tab ${tabId}`);
    const check = await ensureContent(tabId); // inject only once
    if (check) {
      const { config } = await chrome.storage.local.get('config');
      await chrome.tabs.sendMessage(tabId, {
        cmd: 'START_TRACKING',
        config: config,
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
    // This is for messages from the popup and content scripts
    if (msg.cmd === 'START_TRACKING') {
      // 1. Get a guaranteed connection to the offscreen port
      const port = await getOffscreenPort();

      // 2. Send the command to start the camera
      port.postMessage({ cmd: 'START_CAMERA' });

      // 3. Save state and inject content scripts
      await chrome.storage.local.set({ isTrackingActive: true });

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        let check = null; // 0 = non-scriptable, 1 = first injection, 2 = already injected
        try {
          const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'PING' });
          if (res?.ok) check = 2; // already injected
        } catch {
          const injectable = await injectContent(tab.id);
          check = injectable ? 1 : 0;
        }
        if (check === 2) {
          await chrome.tabs.sendMessage(tab.id, {
            cmd: 'START_TRACKING',
            config: msg.config,
          });
        } else if (check === 0) {
          // If user clicks "Start Tracking" on a non-scriptable tab, open a new tab for the user
          await createNewTab();
        }
      }
      sendResponse({ ok: true, message: 'Tracking started.' });
    }
    else if (msg.cmd === 'STOP_TRACKING') {
      // 1. Get the port (it should already exist) and send the stop command
      const offscreenPort = getOffscreenPortRef();
      if (offscreenPort) offscreenPort.postMessage({ cmd: 'STOP_CAMERA' });
      await closeOffscreenIfAny();

      // 2. Update state and tell the content script to clean up, stop the tracking process
      await chrome.storage.local.set({ isTrackingActive: false });
      const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_TRACKING' });
        } catch {
          // This error is expected on pages where the content script is not injected.
          // Likely non-scriptable (chrome:// etc.) – safe to ignore.
        }
      };

      // 3. Remove tabstripStart keys from chrome.storage.local
      if (keysToClear().length) await clearKeys();

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
          } catch {
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
    // --- message handlers for the tabstrip ---
    else if (msg.cmd === 'TABSTRIP_QUERY') {
      const res = await handleTABSTRIP_QUERY();
      sendResponse(res);
    }
    else if (msg.cmd === 'TABSTRIP_NAV') {
      const res = await handleTABSTRIP_NAV(msg);
      sendResponse(res);
    }
    else if (msg.cmd === 'TABSTRIP_ACTIVATE') {
      const res = await handleTABSTRIP_ACTIVATE(msg);
      sendResponse(res);
    }
    else if (msg.cmd === 'TABSTRIP_NEW_TAB') {
      const res = await handleTABSTRIP_NEW_TAB();
      sendResponse(res);
    }
    else if (msg.cmd === 'TABSTRIP_CLOSE') {
      const res = await handleTABSTRIP_CLOSE(msg);
      sendResponse(res);
    }
    else if (msg.cmd === 'TABSTRIP_OPEN_URL') {
      const res = await handleTABSTRIP_OPEN_URL(msg);
      sendResponse(res);
    }
  })();
  return true;
});
