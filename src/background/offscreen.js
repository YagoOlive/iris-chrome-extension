// src/background/offscreen.js

const OFFSCREEN_DOCUMENT_PATH = chrome.runtime.getURL('src/offscreen/index.html');

let offscreenPort = null;

export function getOffscreenPortRef() {
  return offscreenPort;
}

export function setOffscreenPortRef(port) {
  offscreenPort = port;
}

// A helper to check if an offscreen document is already active
async function hasOffscreenDocument() {
  const matchedClients = await clients.matchAll();
  return matchedClients.some(
    (c) => c.url.endsWith(OFFSCREEN_DOCUMENT_PATH)
  );
}

// The main function to create the offscreen document
export async function setupOffscreenDocument() {
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

export async function getOffscreenPort() {
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

export async function closeOffscreenIfAny() {
  try {
    await chrome.offscreen.closeDocument();
  } catch (e) {
    console.warn('Offscreen document already closed.', e);
  }
  offscreenPort = null;
}
