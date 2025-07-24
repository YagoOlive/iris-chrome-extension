// public/content/tracker.js

import * as math from 'mathjs';

import handleCalibrationUpload from "./calibration";

// Use an IIFE to avoid polluting the global scope and run immediately
(() => {
  // 1. Prevent double-injection
  if (window.__htCursorInjected) return;
  window.__htCursorInjected = true;

  // Call the initializer from state.js immediately
  initializeState();

  let sprite = null;
  let port = null;
  let inner = null;
  let notch = null;

  // Edge-scrolling state
  let boundaryTimer = null;
  let scrollInterval = null;
  let lastBoundary = null;  // "top" | "bottom" | null

  // Hover-effect state
  let lastHoverEl = null;
  let activeInteractiveEl = null;
  let anchorX = null;
  let anchorY = null;
  const CLICK_ASSIST_RADIUS = state.config.clickAssistRadius;

  function createSprite() {
    if (sprite) return;
    sprite = document.createElement('div');
    inner = document.createElement('div');
    notch = document.createElement('div');
    sprite.id = 'ht-cursor';
    inner.classList.add('cursor-inner');
    notch.classList.add('cursor-notch');
    document.documentElement.appendChild(sprite);
    sprite.appendChild(inner);
    sprite.appendChild(notch);
  }

  /* Life-cycle helpers */
  function connectPort() {
    if (port) return;
    port = chrome.runtime.connect({ name: 'pose' });
    port.onMessage.addListener(handlePacket);
    port.onDisconnect.addListener(() => (port = null));
  }

  function startTracking(fileContent) {
    createSprite();
    connectPort();
    if (fileContent) handleCalibrationUpload(fileContent);
    window.state.readyToTrack = true;
  }

  console.log('Head-tracking content script injected and state initialized.');

  createSprite();
  connectPort();

  function getClickScore(blends) {
    const clickAction = state.config.actions.click;
    if (clickAction === "smile") {

      const smileL = blends[44]?.score ?? 0;   // 44 = mouthSmileLeft 
      const smileR = blends[45]?.score ?? 0;   // 45 = mouthSmileRight

      return (smileL + smileR) / 2;

    } else if (clickAction === "browUp") {

      const browUpL = blends[4]?.score ?? 0;   // 4 = browOuterUpLeft 
      const browUpR = blends[5]?.score ?? 0;   // 5 = browOuterUpRight

      return (browUpL + browUpR) / 2;

    } else if (clickAction === "jawOpen") {

      const jawOpen = blends[25]?.score ?? 0; // 25 = jawOpen

      return jawOpen;

    } else {
      console.warn(`Click action setting "${clickAction}" is not available.`);
      return 0;
    }
  }

  function handlePacket({ landmarks, blends }) {
    // 1. Save the new landmarks to our global state object
    window.state.lastLandmarks = landmarks;

    maybeClick(getClickScore(blends));

    // console.log("Tracker.js: Landmarks updated!");

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
  }

  // ----- Click on facial expression ----------------------------------------------------
  const CLICK_THRESHOLD = state.config.actions.clickThreshold; // min average score to count as a smile
  const CLICK_COOLDOWN = 1000; // ms between allowed clicks
  let lastClickTime = 0;

  function maybeClick(score) {
    const now = Date.now();
    if (score < CLICK_THRESHOLD) return;
    if (now - lastClickTime < CLICK_COOLDOWN) return;

    // ① find element under the virtual cursor
    const candidate = document.elementFromPoint(state.cursorX, state.cursorY);
    let el = nearestInteractive(candidate);

    if (state.config.clickAssist && activeInteractiveEl) {
      const dx = state.cursorX - anchorX;
      const dy = state.cursorY - anchorY;
      if (Math.hypot(dx, dy) <= CLICK_ASSIST_RADIUS) {
        el = activeInteractiveEl; // honor the lock
      }
    }

    if (!el) return;

    el.click();

    // optional visual feedback:
    // sprite.classList.add('ht-click');   // e.g. scale sprite for 100 ms
    // setTimeout(() => sprite.classList.remove('ht-click'), 100);

    lastClickTime = now;
  }

  const INTERACTIVE_SEL =
    'a[href], button, input, select, textarea, label, [role="button"], [onclick]';

  function nearestInteractive(el) {
    return el?.closest(INTERACTIVE_SEL) || el;   // falls back to the raw element
  }

  // ----- Hover-Effect ----------------------------------------------------
  function updateHover() {
    const candidate = document.elementFromPoint(state.cursorX, state.cursorY);
    const candidateInteractive = nearestInteractive(candidate);
    let el = candidateInteractive;

    const isInteractive = !!el && el.matches(INTERACTIVE_SEL);

    if (state.config.clickAssist) {
      /* -------- ➊ maintain existing lock -------- */
      if (activeInteractiveEl) {
        const dx = state.cursorX - anchorX;
        const dy = state.cursorY - anchorY;
        if (Math.hypot(dx, dy) <= CLICK_ASSIST_RADIUS) {
          el = activeInteractiveEl; // stay locked
        } else {
          activeInteractiveEl = null; // radius broken ⇒ unlock
        }
      }

      /* -------- ➋ acquire new lock -------- */
      if (!activeInteractiveEl && candidateInteractive && isInteractive) {
        activeInteractiveEl = candidateInteractive;
        anchorX = state.cursorX;
        anchorY = state.cursorY;
        el = activeInteractiveEl;
      }
    }

    if (el !== lastHoverEl) {
      lastHoverEl?.classList.remove('ht-hover');
      if (el) el.classList.add('ht-hover');
      lastHoverEl = el;
    }
    if (state.config.clickAssist) {
      sprite.classList.toggle('hovering-link', !!activeInteractiveEl);
    } else {
      sprite.classList.toggle('hovering-link', isInteractive);
    }
  }

  function startScroll(direction) {
    const { speedUp, speedDown, intervalMs } = state.config.scrolling;
    const speed = direction === 'top' ? speedUp : -speedDown;
    scrollInterval = setInterval(() => {
      window.scrollBy(0, speed);
    }, intervalMs);
  }

  function stopScroll() {
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
    if (boundaryTimer) {
      clearTimeout(boundaryTimer);
      boundaryTimer = null;
    }
    lastBoundary = null;
  }


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

    const k = 2;
    // Apply direct exponential smoothing without relative movements
    let smoothing = (state.config.exponentialSmoothingFactor ** k) || 0.95; // Uses configurable value

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

    updateHover();

    // EDGE-SCROLLING LOGIC
    const { thresholdMs } = state.config.scrolling;
    const atBottom = state.cursorY <= 0;
    const atTop = state.cursorY >= window.innerHeight - cursorSize;
    const boundary = atTop ? 'top' : atBottom ? 'bottom' : null;

    if (boundary && (lastBoundary !== boundary)) {
      // just entered a new boundary
      lastBoundary = boundary;
      // start dwell timer
      boundaryTimer = setTimeout(() => {
        startScroll(boundary);
      }, thresholdMs);
    } else if (lastBoundary && !boundary) {
      // left the boundary: stop everything
      stopScroll();
    }


    // Update last positions
    state.lastHeadX = headPositionX;
    state.lastHeadY = headPositionY;
  }

  // --- TEARDOWN ---
  function stopHeadCursor() {
    console.log('Cleaning up tracker script on this page.');
    stopScroll();
    window.state.readyToTrack = false;
    port?.disconnect(); // Close the connection to the background script
    port = null;
    notch?.remove();
    inner?.remove();
    sprite?.remove();
    sprite = null;
    inner = null;
    notch = null;
    window.__htCursorInjected = false;
    const style = document.createElement('style');
    style.textContent = `
      html, body, * {
        cursor: auto !important;
      }
    `;
    // Append it into <head> (or document.documentElement for document_start)
    (document.head || document.documentElement).appendChild(style);
  }

  // --- MESSAGE LISTENER ---
  const messageListener = (msg, sender, sendResponse) => {
    switch (msg.cmd) {
      case 'PING':
        return sendResponse({ ok: true }); // lets background know we’re injected
      case 'START_TRACKING':
        startTracking(msg.calibrationCsvContent);
        const style = document.createElement('style');
        style.textContent = `
          html, body, * {
            cursor: none !important;
          }
        `;
        // Append it into <head> (or document.documentElement for document_start)
        (document.head || document.documentElement).appendChild(style);
        return sendResponse({ ok: true });
      case 'STOP_TRACKING':
        stopHeadCursor();
        return sendResponse({ ok: true });
      case 'UPDATE_SETTINGS':
        for (const setting in msg) {
          if (setting === 'cmd') {
            continue;
          } else if (setting === 'exponentialSmoothingFactor' && typeof msg.exponentialSmoothingFactor === 'number') {
            window.state.config.exponentialSmoothingFactor = msg.exponentialSmoothingFactor;
            console.log('Smoothing factor set to: ', msg.exponentialSmoothingFactor);
          } else if (setting === 'clickAction' && typeof msg.clickAction === 'string') {
            window.state.config.actions.click = msg.clickAction;
            console.log('Click action set to:', msg.clickAction);
          } else if (setting === 'clickAssist') {
            window.state.config.clickAssist = msg.clickAssist ? true : false;
            console.log(`Click Assist set to: ${clickAssist ? 'ON' : 'OFF'}`);
          }
        }
        return sendResponse({ ok: true });
    }
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

  //  --- SETTINGS ---
  chrome.storage.local.get(
    ['exponentialSmoothingFactor', 'clickAction', 'clickAssist'],
    ({ exponentialSmoothingFactor, clickAction, clickAssist }) => {
      if (typeof exponentialSmoothingFactor === 'number') {
        window.state.config.exponentialSmoothingFactor = exponentialSmoothingFactor;
        console.log('Loaded smoothing factor:', exponentialSmoothingFactor);
      }
      if (typeof clickAction === 'string') {
        window.state.config.actions.click = clickAction;
        console.log('Loaded click action:', clickAction);
      }
      window.state.config.clickAssist = clickAssist ? true : false;
      console.log(`Click Assist: ${clickAssist ? 'ON' : 'OFF'}`);
    });

})();
