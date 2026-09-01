// src/background/offscreen.js

const OFFSCREEN_DOCUMENT_PATH = chrome.runtime.getURL('src/offscreen/index.html');

let offscreenPort = null;
// Tracks whether we've already done the "fresh start" close for this
// service-worker session. This prevents double-close when getOffscreenPort()
// is called multiple times (e.g. START_CALIBRATION then START_TRACKING).
let freshStartDone = false;

export function getOffscreenPortRef() {
  return offscreenPort;
}

export function setOffscreenPortRef(port) {
  offscreenPort = port;
}

export async function closeOffscreenIfAny() {
  try {
    await chrome.offscreen.closeDocument();
    console.log('Background: Offscreen document closed.');
  } catch {
    // No document was open — that is fine.
  }
  offscreenPort = null;
}

// Resolve as soon as the offscreen document connects (or reconnects) its port.
// The global onConnect handler in index.js may set the ref first via
// setOffscreenPortRef(), so check that before waiting.
function waitForOffscreenPort() {
  if (offscreenPort) return Promise.resolve(offscreenPort);
  console.log('Background: Waiting for offscreen port to connect...');
  return new Promise((resolve) => {
    const listener = (port) => {
      if (port.name === 'offscreen') {
        chrome.runtime.onConnect.removeListener(listener);
        resolve(port);
      }
    };
    chrome.runtime.onConnect.addListener(listener);
  });
}

// Create the offscreen document.
// On the very first call per service-worker session we close any stale
// document left over from a previous extension reload, then create fresh.
// Subsequent calls reuse the existing document if the port is still alive.
export async function getOffscreenPort() {
  // If we already have a live port, reuse it immediately.
  if (offscreenPort) {
    return offscreenPort;
  }

  // First call this service-worker session.
  if (!freshStartDone) {
    freshStartDone = true;

    // If a document already exists, the service worker was just restarted
    // (the document outlives the worker). Don't tear it down — the offscreen
    // side reconnects its own port, so just wait for it.
    if (await chrome.offscreen.hasDocument()) {
      console.log('Background: Offscreen document survived a worker restart — awaiting reconnect.');
      return waitForOffscreenPort();
    }

    // Otherwise close any stale document from a previous extension reload.
    await closeOffscreenIfAny();
  }

  // Create a new offscreen document.
  console.log('Background: Creating offscreen document.');
  await new Promise((resolve, reject) => {
    chrome.offscreen.createDocument(
      {
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['USER_MEDIA'],
        justification: 'Necessário para acessar a câmera e rastrear a pose da cabeça.',
      },
      () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      }
    );
  });
  console.log('Background: Offscreen document created.');

  return waitForOffscreenPort();
}
