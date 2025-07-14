// public/content/tracker.js

// Use an IIFE to avoid polluting the global scope and run immediately
(() => {
  // 1. Prevent double-injection
  if (window.__htCursorInjected) return;
  window.__htCursorInjected = true;

  // Call the initializer from state.js immediately
  initializeState();

  console.log('Head-tracking content script injected and state initialized.');

  // --- STATE VARIABLES ---
  const sprite = document.createElement('div');
  sprite.id = 'ht-cursor';
  document.documentElement.appendChild(sprite);

  // --- PORT CONNECTION ---
  // Establish a long-lived connection to the background script
  const port = chrome.runtime.connect({ name: 'pose' });

  const follow = e => {
    sprite.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  };

  // Listen for messages (landmark data) from the background script
  port.onMessage.addListener((landmarks) => {
    // 1. Save the new landmarks to our global state object
    window.state.lastLandmarks = landmarks;

    console.log("Tracker.js: Landmarks updated!");
    // console.log(landmarks);

    // 2. TODO: This is where you will process the landmarks
    //    - Use the calibration data (from the CSV) and the new landmarks
    //    - Calculate the new (x, y) screen coordinates
    //    - Apply any filters (like the exponential filter)
    //    - Update the cursor sprite's position

    // For now, let's just log the first landmark to prove it's working
    // and move the cursor based on a simple mapping of the nose tip (landmark 1)
    if (landmarks && landmarks[1]) {
      const noseTip = landmarks[1];
      // A very basic, uncalibrated mapping. Replace with your real logic.
      const x = window.innerWidth * (1 - noseTip.x); // Invert X
      const y = window.innerHeight * noseTip.y;

      sprite.style.transform = `translate(${x}px, ${y}px)`;
    }
  });

  // FOR LATER
  async function startTracking() {
    try {
      // TODO: Use calibration csv to determine tracking
    } catch (err) {
      console.error('Content: Could not get camera stream for tracking.', err);
      // If it fails, clean up this instance.
      stopHeadCursor();
    }
  }

  // --- TEARDOWN ---
  function stopHeadCursor() {
    console.log('Cleaning up tracker script on this page.');
    port.disconnect(); // Close the connection to the background script
    // window.removeEventListener('mousemove', follow);
    if (sprite) sprite.remove();

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
      console.log('Calibration data loaded. Ready for tracking...');
      // IGNORE FOR NOW
      // startTracking();
    } else {
      console.error('Could not find calibration data in storage. Stopping.');
      stopHeadCursor();
    }
  });

})();