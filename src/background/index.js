// src/background/index.js

import { injectContent } from './inject.js';
import { getOffscreenPort, getOffscreenPortRef, setOffscreenPortRef, closeOffscreenIfAny } from './offscreen.js';

// A map to hold all active connections from content scripts
const contentScriptPorts = new Map();

// Port for the calibration popup (CalibrationView)
let calibrationPort = null;

let activeTabId = null;

// True while tracking OR calibration wants the camera pipeline alive. Also
// persisted to storage so it survives a service-worker restart.
async function offscreenWanted() {
  const { isTrackingActive, calibrating } =
    await chrome.storage.local.get(['isTrackingActive', 'calibrating']);
  return !!isTrackingActive || !!calibrating;
}

// --- PORT MANAGEMENT ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'pose') {
    const tabId = port.sender.tab.id;
    contentScriptPorts.set(tabId, port);
    // Re-point the offscreen stream at this tab if it is the focused one, or
    // if we currently have no target (e.g. right after a worker restart).
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([t]) => {
        if (t?.id === tabId || activeTabId == null) activeTabId = tabId;
      })
      .catch(() => { if (activeTabId == null) activeTabId = tabId; });
    console.log(`Background: Port connected from content script in tab ${tabId}`);
    port.onDisconnect.addListener(() => {
      if (contentScriptPorts.get(tabId) === port) {
        contentScriptPorts.delete(tabId);
        console.log(`Background: Port from tab ${tabId} disconnected (current).`);
      } else {
        console.log(`Background: Ignored stale disconnect from older port for tab ${tabId}.`);
      }
    });

  } else if (port.name === 'calibration-pose') {
    // Popup's CalibrationView connects here to receive landmark stream
    calibrationPort = port;
    console.log('Background: Calibration port connected from popup.');
    port.onDisconnect.addListener(() => {
      calibrationPort = null;
      console.log('Background: Calibration port disconnected.');
    });

  } else if (port.name === 'offscreen') {
    setOffscreenPortRef(port);
    console.log('Background: Port connected from offscreen document.');

    // If nothing wants the camera anymore (e.g. a zombie document reconnected
    // after Stop, or the worker restarted after Stop), shut it down.
    offscreenWanted().then((wanted) => {
      if (!wanted) {
        console.log('Background: offscreen connected but nothing wants it — closing.');
        try { port.postMessage({ cmd: 'STOP_CAMERA' }); } catch { /* */ }
        closeOffscreenIfAny();
      }
    });

    port.onMessage.addListener((packet) => {
      // packet = { landmarks, blends }

      // Forward to calibration popup if it is waiting for landmarks
      if (calibrationPort) {
        calibrationPort.postMessage({ landmarks: packet.landmarks });
      }

      // Forward to active content script tab
      if (!activeTabId) return;
      const targetPort = contentScriptPorts.get(activeTabId);
      for (const contentPort of contentScriptPorts.values()) {
        if (contentPort === targetPort) {
          contentPort.postMessage(packet);
        } else {
          contentPort.postMessage({ landmarks: packet.landmarks });
        }
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
    calibrationDone: false,
  });
  console.log('Extension installed. Initial state set.');
});

// 1b. On worker wake: if tracking was active, make sure the camera pipeline is
// alive again. The offscreen document outlives the service worker and reconnects
// its own port; we only need to recreate it if it was destroyed entirely.
async function rearmTracking() {
  const { isTrackingActive } = await chrome.storage.local.get('isTrackingActive');
  if (!isTrackingActive) return;

  if (await chrome.offscreen.hasDocument()) {
    // Document is alive — it reconnects the 'offscreen' port itself.
    return;
  }

  console.log('Background: worker woke with tracking active but no offscreen document — recreating.');
  const port = await getOffscreenPort();
  port.postMessage({ cmd: 'START_CAMERA' });
}

chrome.runtime.onStartup.addListener(rearmTracking);
// Also runs on every cold start of the worker (e.g. woken by an event).
rearmTracking();

// 2. On Tab Update: (re)start tracking when a tab finishes navigating.
// The declarative boot.js already covers most navigations via ENSURE_TRACKING;
// this is a backstop for cases where the message is missed.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || (!tab.url.startsWith('http') && !tab.url.startsWith('file'))) return;

  const { isTrackingActive, config } = await chrome.storage.local.get(['isTrackingActive', 'config']);
  if (!isTrackingActive || !config) return;

  await startTrackingInTab(tabId, config);
});

// 3. Active Tab Tracking: (re)start on tab activation
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  activeTabId = tabId;
  const { isTrackingActive, config } = await chrome.storage.local.get(['isTrackingActive', 'config']);
  if (!isTrackingActive || !config) return;

  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch { return; }
  if (!tab?.url || (!tab.url.startsWith('http') && !tab.url.startsWith('file'))) return;

  await startTrackingInTab(tabId, config);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activeTabId = null;
    return;
  }
  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs.length) activeTabId = tabs[0].id;
  });
});

// Inject the full tracking pipeline into a tab (if absent) and start it.
// Returns true if the tab is scriptable and was (re)started.
const startingTabs = new Set(); // tabIds with an in-flight startTrackingInTab

async function startTrackingInTab(tabId, config) {
  if (startingTabs.has(tabId)) return true; // dedupe concurrent triggers
  startingTabs.add(tabId);
  try {
    let injected;
    try {
      const res = await chrome.tabs.sendMessage(tabId, { cmd: 'PING' });
      injected = !!res?.ok;
    } catch {
      injected = false;
    }

    if (!injected) {
      const ok = await injectContent(tabId);
      if (!ok) return false; // non-scriptable
      // Give the freshly injected IIFEs a moment to register their listeners.
      await new Promise((r) => setTimeout(r, 80));
    }

    try {
      await chrome.tabs.sendMessage(tabId, { cmd: 'START_TRACKING', config });
    } catch {
      /* tab navigated again before we could send — a later signal will retry */
    }
    return true;
  } finally {
    startingTabs.delete(tabId);
  }
}

async function handleSTART_TRACKING({ config }) {
  // Mark active BEFORE creating the offscreen document, so the "close it if
  // nothing wants it" guard on offscreen connect sees the right state.
  await chrome.storage.local.set({ isTrackingActive: true });

  const port = await getOffscreenPort();
  port.postMessage({ cmd: 'START_CAMERA' });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Only inject into scriptable tabs (http/https/file)
  if (!tab?.url || (!tab.url.startsWith('http') && !tab.url.startsWith('file'))) {
    await chrome.tabs.create({ url: 'https://www.google.com', active: true });
    return { ok: true, message: 'Tracking started.' };
  }

  activeTabId = tab.id;
  const started = await startTrackingInTab(tab.id, config);
  if (!started) {
    await chrome.tabs.create({ url: 'https://www.google.com', active: true });
  }
  return { ok: true, message: 'Tracking started.' };
}

async function handleSTOP_TRACKING() {
  // Flip state FIRST so any in-flight offscreen (re)connection closes itself.
  await chrome.storage.local.set({ isTrackingActive: false });
  await chrome.storage.local.remove('calibrating');

  const offscreenPort = getOffscreenPortRef();
  if (offscreenPort) {
    try { offscreenPort.postMessage({ cmd: 'STOP_CAMERA' }); } catch { /* dead port */ }
  }
  await closeOffscreenIfAny();

  activeTabId = null;

  // Only send STOP_TRACKING to scriptable tabs.
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_TRACKING' });
    } catch { /* tab has no listener or is non-scriptable, ignore */ }
  }

  return { ok: true, message: 'Tracking stopped.' };
}

async function handleSTART_CALIBRATION() {
  await chrome.storage.local.set({ calibrating: true });
  const port = await getOffscreenPort();
  port.postMessage({ cmd: 'START_CAMERA' });
  return { ok: true };
}

async function handleSTOP_CALIBRATION() {
  await chrome.storage.local.remove('calibrating');
  // Stop camera only if tracking is not also active
  const { isTrackingActive } = await chrome.storage.local.get('isTrackingActive');
  if (!isTrackingActive) {
    const offscreenPort = getOffscreenPortRef();
    if (offscreenPort) {
      try { offscreenPort.postMessage({ cmd: 'STOP_CAMERA' }); } catch { /* dead port */ }
    }
    await closeOffscreenIfAny();
  }
  return { ok: true };
}

async function toggleTracking() {
  const { isTrackingActive, config, calibrationDone } =
    await chrome.storage.local.get(['isTrackingActive', 'config', 'calibrationDone']);

  if (isTrackingActive) {
    await handleSTOP_TRACKING();
  } else {
    const { state } = await navigator.permissions.query({ name: 'camera' });
    if (!config || !calibrationDone || state !== 'granted') {
      await chrome.action.openPopup();
      return;
    }
    await handleSTART_TRACKING({ config });
  }

  try {
    await chrome.runtime.sendMessage({ cmd: 'CLOSE_POPUP_IF_OPEN' });
  } catch { /* popup not open */ }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-tracking') toggleTracking();
});

// --- MESSAGE HANDLER ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.cmd === 'START_TRACKING') {
      sendResponse(await handleSTART_TRACKING(msg));

    } else if (msg.cmd === 'ENSURE_TRACKING') {
      // From boot.js on a fresh navigation / bfcache restore.
      const tabId = sender.tab?.id;
      const { isTrackingActive, config } =
        await chrome.storage.local.get(['isTrackingActive', 'config']);
      if (tabId != null && isTrackingActive && config) {
        try {
          const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (active?.id === tabId || activeTabId == null) activeTabId = tabId;
        } catch { /* ignore */ }
        await startTrackingInTab(tabId, config);
      }
      sendResponse({ ok: true });

    } else if (msg.cmd === 'STOP_TRACKING') {
      sendResponse(await handleSTOP_TRACKING());

    } else if (msg.cmd === 'START_CALIBRATION') {
      sendResponse(await handleSTART_CALIBRATION());

    } else if (msg.cmd === 'STOP_CALIBRATION') {
      sendResponse(await handleSTOP_CALIBRATION());

    } else if (msg.cmd === 'UPDATE_SETTINGS') {
      console.log('Updating settings…');
      for (const setting in msg) {
        if (setting === 'cmd') continue;
        await chrome.storage.local.set({ [setting]: msg[setting] });
        const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
        for (const tab of tabs) {
          try {
            await chrome.tabs.sendMessage(tab.id, { cmd: 'UPDATE_SETTINGS', [setting]: msg[setting] });
          } catch { /* non-scriptable */ }
        }
      }
      sendResponse({ ok: true });

    } else if (msg.cmd === 'CAMERA_RESULT') {
      if (sender.tab?.id) await chrome.tabs.remove(sender.tab.id);
      const { state } = await navigator.permissions.query({ name: 'camera' });
      if (state !== 'granted') {
        await chrome.storage.local.set({ autoEnableCamera: state });
      }
      await chrome.action.openPopup();
    }
  })();
  return true;
});
