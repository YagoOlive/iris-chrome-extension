// public/content/tracker.js

import handleCalibrationUpload from "./calibration";

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

    if (!window.state.readyToTrack) {
      console.log("Not yet ready....");
      return;
    }

    // Get current landmark configuration
    const currentConfig = state.config.landmarkPoints; // default is 3 points, else 6 points

    // Define landmark indices
    const indices = currentConfig === "3" ? [1, 33, 263] : [1, 61, 291, 152, 33, 263];
    const quadraticScale = 0.00001;

    let vector = [];

    // 2D mode - only use x and y coordinates
    for (const index of indices) {
      const landmark = landmarks[index];
      if (!landmark) continue;

      const x = landmark.x * window.innerWidth;
      const y = landmark.y * window.innerHeight;

      vector.push([x]);
      vector.push([y]);
      vector.push([x * x * quadraticScale]);
      vector.push([y * y * quadraticScale]);
    }

    // Select 2D matrix
    const matrix = currentConfig === "3" ?
      state.transformationMatrices.threePoint2d :
      state.transformationMatrices.sixPoint2d;

    if (!matrix) {
      console.error("No 2D transformation matrix available!");
      return;
    }

    // Verify vector dimensions
    const expectedLength = currentConfig === "3" ? 12 : 24;
    if (vector.length !== expectedLength) {
      console.error(`2D vector has wrong length: ${vector.length}, expected: ${expectedLength}`);
      return;
    }

    // Calculate cursor position with 2D matrix
    const P = math.matrix(vector);
    const B = math.matrix(matrix);
    try {
      const Q = math.multiply(B, P);
      const position = Q.toArray();

      const headPositionX = position[0][0];
      const headPositionY = position[1][0];

      // Apply filtering and update cursor position
      applyFilteringAndUpdateCursor(headPositionX, headPositionY);
    } catch (error) {
      console.error("Matrix multiplication error in 2D mode:", error);
    }

    // Example:
    // For now, let's just log the first landmark to prove it's working
    // and move the cursor based on a simple mapping of the nose tip (landmark 1)
    // if (landmarks && landmarks[1]) {
    //   const noseTip = landmarks[1];
    //   // A very basic, uncalibrated mapping. Replace with your real logic.
    //   const x = window.innerWidth * (1 - noseTip.x); // Invert X
    //   const y = window.innerHeight * noseTip.y;

    //   sprite.style.transform = `translate(${x}px, ${y}px)`;
    // }
  });

  // Helper function for applying filtering and updating cursor position
  function applyFilteringAndUpdateCursor(headPositionX, headPositionY) {
    // Exponential smoothing
    if (state.lastHeadX === null) {
      window.state.lastHeadX = headPositionX;
      window.state.cursorX = headPositionX;
      window.state.rawCursorX = headPositionX;
    }
    if (state.lastHeadY === null) {
      window.state.lastHeadY = headPositionY;
      window.state.cursorY = headPositionY;
      window.state.rawCursorY = headPositionY;
    }

    // Get cursor element
    let cursorWithClipping = document.getElementById("ht-cursor");

    if (!cursorWithClipping) {
      console.error("Cursor element not found.");
      return;
    }

    // Apply direct exponential smoothing without relative movements
    const smoothing = state.config.exponentialSmoothingFactor || 0.95; // Uses configurable value

    // Apply smoothing directly to cursor position
    if (state.cursorX === null) {
      window.state.cursorX = headPositionX;
      window.state.cursorY = headPositionY;
    } else {
      // Direct exponential smoothing
      window.state.cursorX = state.cursorX + (1 - smoothing) * (headPositionX - state.cursorX);
      window.state.cursorY = state.cursorY + (1 - smoothing) * (headPositionY - state.cursorY);
    }

    // Apply bounds
    const cursorSize = 24;
    state.cursorX = Math.max(
      0,
      Math.min(window.innerWidth - cursorSize, state.cursorX)
    );
    state.cursorY = Math.max(
      0,
      Math.min(window.innerHeight - cursorSize, state.cursorY)
    );

    // Round for display
    const roundedX = Math.round(state.cursorX);
    const roundedY = Math.round(state.cursorY);

    // Update cursor position
    cursorWithClipping.style.left = `${roundedX}px`;
    cursorWithClipping.style.top = `${roundedY}px`;

    // Update last positions
    state.lastHeadX = headPositionX;
    state.lastHeadY = headPositionY;
  }

  // --- TEARDOWN ---
  function stopHeadCursor() {
    console.log('Cleaning up tracker script on this page.');
    port.disconnect(); // Close the connection to the background script
    // window.removeEventListener('mousemove', follow);
    if (sprite) sprite.remove();

    delete window.__htCursorInjected;
    window.state.readyToTrack = false;
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
  chrome.storage.local.get(['calibrationCsvContent'], ({ calibrationCsvContent }) => {
    if (calibrationCsvContent) {
      const success = handleCalibrationUpload(calibrationCsvContent);
      if (success) {
        window.state.readyToTrack = true;
        console.log('Calibration data loaded. Ready for tracking...');
      }
    } else {
      console.error('Could not find calibration data in storage. Stopping.');
      stopHeadCursor();
    }
  });

})();
