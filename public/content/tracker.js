// public/content/tracker.js

// Use an IIFE to avoid polluting the global scope and run immediately
(() => {
  // 1. Prevent double-injection
  if (window.__htCursorInjected) return;
  window.__htCursorInjected = true;

  console.log('Head-tracking content script injected.');

  // --- STATE VARIABLES ---
  let localStream = null; // To hold the stream for this specific tab
  const sprite = document.createElement('div');
  sprite.id = 'ht-cursor';
  document.documentElement.appendChild(sprite);

  // --- CORE LOGIC ---
  const follow = e => {
    sprite.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  };

  // This function now also handles starting the camera for this tab
  async function startCameraAndTracking() {
    try {
      // Because the offscreen document holds an active stream, this call
      // will not trigger a new user prompt and will share the camera resource.
      console.log('Content: Requesting local camera stream for processing.');
      // localStream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('Content: Local stream acquired.');

      // ---
      // TODO: Initialize your head-tracking algorithm here
      // Pass the `localStream` or a video element with its srcObject set to it.
      // Example:
      // const video = document.createElement('video');
      // video.srcObject = localStream;
      // video.play();
      // yourHeadTracker.init(video);
      // ---

      // For now, we just start the mouse follower
      window.addEventListener('mousemove', follow, { passive: true });

    } catch (err) {
      console.error('Content: Could not get camera stream for tracking.', err);
      // If it fails, clean up this instance.
      stopHeadCursor();
    }
  }

  // --- TEARDOWN ---
  function stopHeadCursor() {
    console.log('Cleaning up tracker script on this page.');
    window.removeEventListener('mousemove', follow);
    if (sprite) sprite.remove();

    // Stop the local stream for this tab
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      console.log('Content: Local stream stopped.');
    }
    
    delete window.__htCursorInjected;
    chrome.runtime.onMessage.removeListener(messageListener);
  }

  // --- MESSAGE LISTENER ---
  const messageListener = (msg, sender, sendResponse) => {
    if (msg.cmd === 'STOP_TRACKING') {
      stopHeadCursor();
      sendResponse({ ok: true });
    }
    return true;
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // --- INITIALIZATION ---
  chrome.storage.local.get('calibrationCsv', ({ calibrationCsv }) => {
    if (calibrationCsv) {
      console.log('Calibration data loaded. Starting camera and tracking...');
      startCameraAndTracking(); // Call the new async function
    } else {
      console.error('Could not find calibration data in storage. Stopping.');
      stopHeadCursor();
    }
  });

})();