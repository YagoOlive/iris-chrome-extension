// src/background/index.js

import stateScript from '../content/state.js?script';
import trackerScript from '../content/tracker.js?script';

import scrollScript from '../content/scroll.js?script';
import clickScoreScript from '../content/click-score.js?script';
import settingsScript from '../content/settings.js?script';
import tabstripScript from '../content/tabstrip.js?script';

const OFFSCREEN_DOCUMENT_PATH = chrome.runtime.getURL('src/offscreen/index.html');

// A map to hold all active connections from content scripts
const contentScriptPorts = new Map();

let offscreenPort = null;
let activeTabId = null;

let tabstripStartKeys = [];

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
  // This promise will resolve when the onConnect listener in this script assigns a value to `offscreenPort`.
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
      files: ['content/cursor.css', 'content/tabstrip.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [
        stateScript,
        trackerScript,
        scrollScript,
        clickScoreScript,
        settingsScript,
        tabstripScript,
      ],
    });
  } catch (err) {
    console.error(`Failed to inject content into tab ${tabId}:`, err);
    return false;
  }
  return true;
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
  } catch {
    // This error is expected on pages where the content script is not injected.
    // console.log(`Could not clean up tab ${tabId}, it might not have the content script.`);
  }
}

function storageKeyForStart(windowId) {
  return `tabstripStart:${windowId}`;
}

async function getFilteredCurrentWindowTabs() {
  const all = await chrome.tabs.query({ currentWindow: true });
  return all.filter(t => /^https?:|^file:/.test(t.url || '')); // skip chrome://, chrome-extension://, devtools://
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

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

// async function broadcastToHTTPTabs(payload) {
//   const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
//   for (const t of tabs) {
//     try {
//       await chrome.tabs.sendMessage(t.id, payload);
//     } catch {
//       /* tab is non-scriptable, content script not injected */
//     }
//   }
// }

async function slideTabWindowRight(created) {
  // Slide window to include the new rightmost tab
  const filtered = await getFilteredCurrentWindowTabs();
  const key = storageKeyForStart(created.windowId);
  const maxStart = Math.max(0, filtered.length - 8);
  await chrome.storage.local.set({ [key]: maxStart });
  if (!tabstripStartKeys.includes(key)) tabstripStartKeys.push(key);
}

async function createNewTab() {
  const created = await chrome.tabs.create({ url: 'https://www.google.com', active: true });
  await slideTabWindowRight(created);
  return created;
}

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

      // 3. Remove tabstripStart keys from chrome.storage.local
      for (const key of tabstripStartKeys) {
        await chrome.storage.local.remove(key);
      }

      tabstripStartKeys = [];

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
      const filtered = await getFilteredCurrentWindowTabs();
      const activeIdx = filtered.findIndex(t => t.active);

      const windowId = filtered[activeIdx]?.windowId ?? (await chrome.windows.getCurrent())?.id;
      const key = storageKeyForStart(windowId);
      const maxStart = Math.max(0, filtered.length - 9);

      // read persisted start; if missing, center active on first open
      const got = await chrome.storage.local.get(key);
      let start = typeof got[key] === 'number'
        ? clamp(got[key], 0, maxStart)
        : clamp(activeIdx - 4, 0, maxStart);
      if (!(key in got)) {
        await chrome.storage.local.set({ [key]: start });
        if (!tabstripStartKeys.includes(key)) tabstripStartKeys.push(key);
      }
      let end = Math.min(filtered.length, start + 9);
      if (end - start < 9) start = Math.max(0, end - 9);

      const windowed = filtered.slice(start, end).map(t => ({
        id: t.id,
        windowId: t.windowId,
        title: t.title || 'Untitled',
        favIconUrl: t.favIconUrl || '',
        index: t.index,
        active: t.active
      }));

      sendResponse({
        ok: true,
        tabs: windowed,
        activeTabId: filtered[activeIdx]?.id ?? null,
        canPagePrev: start > 0,
        canPageNext: end < filtered.length
      });
    }
    else if (msg.cmd === 'TABSTRIP_NAV') {
      const dir = msg.dir; // 'prev' | 'next'
      const filtered = await getFilteredCurrentWindowTabs();
      const activeIdx = filtered.findIndex(t => t.active);
      const windowId = filtered[activeIdx]?.windowId ?? (await chrome.windows.getCurrent())?.id;
      const key = storageKeyForStart(windowId);
      const maxStart = Math.max(0, filtered.length - 9);
      const got = await chrome.storage.local.get(key);
      let start = clamp((typeof got[key] === 'number' ? got[key] : 0) + (dir === 'next' ? 9 : -9), 0, maxStart);
      await chrome.storage.local.set({ [key]: start });
      if (!tabstripStartKeys.includes(key)) tabstripStartKeys.push(key);
      let end = Math.min(filtered.length, start + 9);
      if (end - start < 9) start = Math.max(0, end - 9);
      const windowed = filtered.slice(start, end).map(t => ({
        id: t.id, windowId: t.windowId, title: t.title || 'Untitled',
        favIconUrl: t.favIconUrl || '', index: t.index, active: t.active
      }));
      sendResponse({
        ok: true,
        tabs: windowed,
        activeTabId: filtered[activeIdx]?.id ?? null,
        canPagePrev: start > 0,
        canPageNext: end < filtered.length
      });
    }
    else if (msg.cmd === 'TABSTRIP_ACTIVATE') {
      const { tabId, windowId } = msg;
      try {
        // Bring window to front (if different), then activate the tab
        if (windowId !== undefined) {
          await chrome.windows.update(windowId, { focused: true });
        }

        const isAlreadyInjected = await ensureContent(tabId);

        if (isAlreadyInjected) {
          await chrome.storage.local.set({ tabstripForceOpen: 'reopen' });
          await chrome.tabs.sendMessage(tabId, { cmd: 'GLOBAL_CLICK_SUPPRESS' });
        } else {
          await chrome.storage.local.set({ tabstripForceOpen: 'initial' });
        }

        await chrome.tabs.update(tabId, { active: true }); // switches tabs

        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message });
      }
    }
    else if (msg.cmd === 'TABSTRIP_NEW_TAB') {
      try {
        const created = await createNewTab();
        sendResponse({ ok: true, tabId: created.id });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message });
      }
    }
    else if (msg.cmd === 'TABSTRIP_CLOSE') {
      const { tabId } = msg;
      try {
        // If closing the active tab, proactively suppress clicks in the replacement
        const filtered = await getFilteredCurrentWindowTabs();
        const idx = filtered.findIndex(t => t.id === tabId);
        if (idx !== -1 && filtered[idx].active) {
          const replacement = filtered[idx + 1] || filtered[idx - 1];
          if (replacement) {
            const injected = await ensureContent(replacement.id);
            if (injected) {
              await chrome.tabs.sendMessage(replacement.id, { cmd: 'GLOBAL_CLICK_SUPPRESS' });
              await chrome.storage.local.set({ tabstripForceOpen: 'reopen' });
            } else {
              await chrome.storage.local.set({ tabstripForceOpen: 'initial' });
            }
          }
        }
        await chrome.tabs.remove(tabId); // close after suppression
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message });
      }
    }
    else if (msg.cmd === 'TABSTRIP_NAVIGATE') {
      try {
        const { action } = msg; // 'back' | 'forward' | 'reload'
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) return sendResponse({ ok: false, error: 'No active tab' });

        // soften any pending gesture click
        try {
          await chrome.tabs.sendMessage(activeTab.id, { cmd: 'GLOBAL_CLICK_SUPPRESS' });
        } catch {
          /* Tab has no listener or is non-scriptable; ignore */
        }

        if (action === 'back') {
          await chrome.tabs.goBack(activeTab.id);
        } else if (action === 'forward') {
          await chrome.tabs.goForward(activeTab.id);
        } else if (action === 'reload') {
          await chrome.tabs.reload(activeTab.id);
        }
        // keep the island visible after nav
        // await chrome.storage.local.set({ tabstripForceOpen: 'reopen' });
        sendResponse({ ok: true });
      } catch (e) {
        // No-op if back/forward not available; API simply rejects.
        sendResponse({ ok: false, error: e?.message });
      }
    }
    else if (msg.cmd === 'TABSTRIP_OPEN_URL') {
      try {
        const q = (msg.q || '').trim();
        if (!q) return sendResponse({ ok: false, error: 'Empty query' });

        // URL heuristics → otherwise Google search
        const looksURL = /^(https?:|file:)/i.test(q) || (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(q) && !/\s/.test(q));
        const finalUrl = looksURL ? (/^(https?:|file:)/i.test(q) ? q : `https://${q}`)
          : `https://www.google.com/search?q=${encodeURIComponent(q)}`;

        const created = await chrome.tabs.create({ url: finalUrl, active: true });

        // Slide to show the brand new tab at the far right
        await slideTabWindowRight(created);

        sendResponse({ ok: true, tabId: created.id });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message });
      }
    }
  })();
  return true;
});
