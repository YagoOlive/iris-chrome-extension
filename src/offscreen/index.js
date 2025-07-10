// src/offscreen/index.js

let stream;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(msg) {
  if (msg.target !== 'offscreen') {
    return;
  }

  if (msg.cmd === 'START_CAMERA') {
    if (stream) {
      console.log('Offscreen: Camera stream already active.');
      return;
    }
    try {
      console.log('Offscreen: Requesting camera stream...');
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('Offscreen: Camera stream acquired.');
      // The stream is now active. The camera light should be on.
      // We don't need to do anything with the stream here; its existence
      // is what keeps the camera active for the content scripts to use.
    } catch (err) {
      console.error('Offscreen: Failed to get user media', err);
      stream = null;
    }
  } else if (msg.cmd === 'STOP_CAMERA') {
    if (stream) {
      console.log('Offscreen: Stopping camera stream...');
      stream.getTracks().forEach(track => track.stop());
      console.log('Offscreen: Camera stream stopped.');
      stream = null;
    }
    // The offscreen document will automatically close after 30 seconds of inactivity.
  }
}