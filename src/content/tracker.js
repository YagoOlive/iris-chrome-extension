// public/content/tracker.js

import * as math from 'mathjs';

import handleCalibrationUpload from "./calibration";

// Use an IIFE to avoid polluting the global scope and run immediately
(() => {
  // Prevent double-injection
  if (window.__htCursorInjected) return;
  window.__htCursorInjected = true;

  // Call the initializer from state.js immediately
  initializeState();

  const CLICK_COOLDOWN = 1000; // ms between allowed clicks

  // Click threshold value for each click action
  const clickThresholdAction = {
    smile: 0.8,
    browUp: 0.8,
    jawOpen: 0.6,
  }

  let sprite = null;
  let port = null;
  let inner = null;
  let notch = null;

  // Edge-scrolling state
  let boundaryTimer = null;
  let scrollInterval = null;
  let lastBoundary = null;  // "top" | "bottom" | null

  // Click-assist state
  let lastHoverEl = null;
  let activeInteractiveEl = null;
  let anchorX = null;
  let anchorY = null;
  let lockStartTime = null;

  let lastClickTime = 0;

  // Dwell-click state
  let dwellAnchorX = null;
  let dwellAnchorY = null;
  let dwellStartTime = null;

  // Dwell ring elements
  let dwellRing = null;
  let dwellTrack = null;
  let dwellProg = null;
  let dwellCircumference = 0;

  function createDwellRing() {
    if (dwellRing) return;

    // 36x36 viewbox, radius 16 for a tidy ring with 3.5px stroke
    dwellRing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    dwellRing.setAttribute("class", "dwell-ring");
    dwellRing.setAttribute("viewBox", "0 0 36 36");

    dwellTrack = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dwellTrack.setAttribute("class", "track");
    dwellTrack.setAttribute("cx", "18");
    dwellTrack.setAttribute("cy", "18");
    dwellTrack.setAttribute("r", "16");

    dwellProg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dwellProg.setAttribute("class", "progress");
    dwellProg.setAttribute("cx", "18");
    dwellProg.setAttribute("cy", "18");
    dwellProg.setAttribute("r", "16");

    dwellRing.appendChild(dwellTrack);
    dwellRing.appendChild(dwellProg);
    sprite.appendChild(dwellRing);

    const r = 16;
    dwellCircumference = 2 * Math.PI * r;
    dwellProg.style.strokeDasharray = `${dwellCircumference}`;
    dwellProg.style.strokeDashoffset = `${dwellCircumference}`;
  }

  function setDwellProgress(p) {
    // p in [0,1]
    const clamped = Math.max(0, Math.min(1, p));
    const remaining = (1 - clamped) * dwellCircumference;
    dwellProg.style.strokeDashoffset = `${remaining}`;

    // nudge color as you near completion
    if (clamped > 0.85) {
      dwellProg.style.stroke = getComputedStyle(document.documentElement)
        .getPropertyValue('--dwell-near-done') || '#f80c8e';
    } else {
      dwellProg.style.stroke = getComputedStyle(document.documentElement)
        .getPropertyValue('--dwell-progress') || '#fdc203';
    }
  }

  function showDwellRing(on) {
    sprite.classList.toggle('dwell-active', !!on);
    if (!on && dwellProg) {
      dwellProg.style.strokeDashoffset = `${dwellCircumference}`;
    }
  }


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

    createDwellRing();

    // Round for display
    const roundedX = Math.round(window.innerWidth / 2);
    const roundedY = Math.round(window.innerHeight / 2);

    // Initialize cursor at the center of the screen
    sprite.style.left = `${roundedX}px`;
    sprite.style.top = `${roundedY}px`;
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

      const smileL = blends[44]?.score ?? 0; // 44 = mouthSmileLeft 
      const smileR = blends[45]?.score ?? 0; // 45 = mouthSmileRight

      return (smileL + smileR) / 2;

    } else if (clickAction === "browUp") {

      const browUpL = blends[4]?.score ?? 0; // 4 = browOuterUpLeft 
      const browUpR = blends[5]?.score ?? 0; // 5 = browOuterUpRight

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

    if (!window.state.readyToTrack) {
      console.log("Not yet ready....");
      return;
    }

    maybeClick(getClickScore(blends));

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

      // Use calibration dimensions to maintain consistency
      const calibrationWidth = state.calibrationData.calibrationWidth || window.innerWidth;
      const calibrationHeight = state.calibrationData.calibrationHeight || window.innerHeight;

      const x = landmark.x * calibrationWidth;
      const y = landmark.y * calibrationHeight;

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
      applyFilteringAndUpdateCursor(
        headPositionX * (window.innerWidth / state.calibrationData.calibrationWidth),
        headPositionY * (window.innerHeight / state.calibrationData.calibrationHeight)
      );
    } catch (error) {
      console.error("Matrix multiplication error in 2D mode:", error);
    }
  }

  // ----- Click on facial expression ----------------------------------------------------
  function maybeClick(score) {
    const now = Date.now();
    if (score < state.config.actions.clickThreshold) return;
    if (now - lastClickTime < CLICK_COOLDOWN) return;

    // ① find element under the virtual cursor
    const candidate = document.elementFromPoint(state.cursorX, state.cursorY);
    let el = nearestInteractive(candidate);

    if (state.config.clickAssist && activeInteractiveEl) {
      const dx = state.cursorX - anchorX;
      const dy = state.cursorY - anchorY;
      if (Math.hypot(dx, dy) <= state.config.clickAssistRadius) {
        el = activeInteractiveEl; // honor the lock
      }
    }
    if (el) {
      el.click();
      lastClickTime = now;
      showDwellRing(false);
      dwellAnchorX = null;
      dwellAnchorY = null;
    }
  }

  function startDwell() {
    dwellAnchorX = state.cursorX;
    dwellAnchorY = state.cursorY;
    dwellStartTime = Date.now();
    showDwellRing(true);
    setDwellProgress(0);
  }

  function handleDwellClick() {
    if (!state.config.dwellClick || !window.state.readyToTrack) {
      showDwellRing(false);
      return;
    }

    const now = Date.now();

    /* ➊ cooldown → require movement after a dwell fire */
    if (now - lastClickTime < CLICK_COOLDOWN) {
      showDwellRing(false);
      return;
    }

    /* ➋ initialise if we have no anchor yet */
    if (dwellAnchorX === null) {
      startDwell();
      return;
    }

    /* ➌ reset if pointer left the dwell circle */
    const dx = state.cursorX - dwellAnchorX;
    const dy = state.cursorY - dwellAnchorY;
    if (Math.hypot(dx, dy) > state.config.dwellArea) {
      startDwell();
      return;
    }

    // ➍ inside circle: update progress
    const p = (now - dwellStartTime) / state.config.dwellTime;
    showDwellRing(true);
    setDwellProgress(p);

    if (p >= 1) {
      const candidate = document.elementFromPoint(state.cursorX, state.cursorY);
      let el = nearestInteractive(candidate);

      el?.click();

      dwellAnchorX = null;
      dwellAnchorY = null;
      lastClickTime = now;
    }
  }

  const INTERACTIVE_SEL =
    'a[href], button, input, select, textarea, label, [role="button"], [onclick]';

  function nearestInteractive(el) {
    return el?.closest(INTERACTIVE_SEL) || el;   // falls back to the raw element
  }

  function recordLock() {
    anchorX = state.cursorX;
    anchorY = state.cursorY;
    lockStartTime = Date.now();
  }

  // ----- Hover-Effect ----------------------------------------------------
  function updateHover() {
    const candidate = document.elementFromPoint(state.cursorX, state.cursorY);
    const candidateInteractive = nearestInteractive(candidate);
    let el = candidateInteractive;

    const isInteractive = !!el && el.matches(INTERACTIVE_SEL);

    const now = Date.now();

    if (state.config.clickAssist) {
      /* -------- ➊ maintain existing lock -------- */
      // if the pointer is still inside the interactive element, record a new anchor point
      if (activeInteractiveEl && isInteractive && candidateInteractive === activeInteractiveEl) {
        recordLock();
      } else if (activeInteractiveEl) { // exited the interactive element ⇒ check if still in click radius buffer and time has not expired
        const dx = state.cursorX - anchorX;
        const dy = state.cursorY - anchorY;
        if (Math.hypot(dx, dy) <= state.config.clickAssistRadius && now - lockStartTime < state.config.clickAssistTimeout) {
          el = activeInteractiveEl; // stay locked
        } else {
          activeInteractiveEl = null; // radius broken ⇒ unlock
        }
      }

      /* -------- ➋ acquire new lock -------- */
      if (!activeInteractiveEl && candidateInteractive && isInteractive) {
        activeInteractiveEl = candidateInteractive;
        recordLock();
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
    handleDwellClick();

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

  // Create element to remove/restore the default cursor
  const style = document.createElement('style');
  // Append it into <head> (or document.documentElement for document_start)
  (document.head || document.documentElement).appendChild(style);

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
    dwellRing?.remove();
    dwellTrack?.remove();
    dwellProg?.remove();
    dwellRing = null;
    dwellTrack = null;
    dwellProg = null;
    window.__htCursorInjected = false;
    style.textContent = `
      html, body, * {
        cursor: auto !important;
      }
    `;
  }

  // --- MESSAGE LISTENER ---
  const messageListener = (msg, sender, sendResponse) => {
    switch (msg.cmd) {
      case 'PING':
        return sendResponse({ ok: true }); // lets background know we’re injected
      case 'START_TRACKING':
        startTracking(msg.calibrationCsvContent);
        style.textContent = `
          html, body, * {
            cursor: none !important;
          }
        `;
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
            window.state.config.actions.clickThreshold = clickThresholdAction[msg.clickAction] || 1.0;
            console.log('Click action threshold set to:', state.config.actions.clickThreshold);
          } else if (setting === 'clickAssist') {
            window.state.config.clickAssist = msg.clickAssist ? true : false;
            console.log(`Click Assist set to: ${msg.clickAssist ? 'ON' : 'OFF'}`);
          } else if (setting === 'clickTimeout' && typeof msg.clickTimeout === 'number') {
            window.state.config.clickAssistTimeout = msg.clickTimeout;
            console.log(`Click Assist Timeout set to: ${msg.clickTimeout}ms`);
          } else if (setting === 'clickRadius' && typeof msg.clickRadius === 'number') {
            window.state.config.clickAssistRadius = msg.clickRadius;
            console.log(`Click Assist Radius set to: ${msg.clickRadius}px`);
          } else if (setting === 'dwellClick') {
            window.state.config.dwellClick = msg.dwellClick ? true : false;
            console.log(`Dwell Click set to: ${msg.dwellClick ? 'ON' : 'OFF'}`);
          } else if (setting === 'dwellTime' && typeof msg.dwellTime === 'number') {
            window.state.config.dwellTime = msg.dwellTime;
            console.log(`Dwell Time set to: ${msg.dwellTime}ms`);
          } else if (setting === 'dwellArea' && typeof msg.dwellArea === 'number') {
            window.state.config.dwellArea = msg.dwellArea;
            console.log(`Dwell Area set to: ${msg.dwellArea}px`);
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
    ['exponentialSmoothingFactor', 'clickAction', 'clickAssist', 'clickTimeout', 'clickRadius',
      'dwellClick', 'dwellTime', 'dwellArea'],
    ({ exponentialSmoothingFactor, clickAction, clickAssist, clickTimeout, clickRadius,
      dwellClick, dwellTime, dwellArea }) => {
      if (typeof exponentialSmoothingFactor === 'number') {
        window.state.config.exponentialSmoothingFactor = exponentialSmoothingFactor;
        console.log('Loaded smoothing factor:', exponentialSmoothingFactor);
      }
      if (typeof clickAction === 'string') {
        window.state.config.actions.click = clickAction;
        console.log('Loaded click action:', clickAction);
        window.state.config.actions.clickThreshold = clickThresholdAction[clickAction] || 1.0;
        console.log('Click action threshold:', state.config.actions.clickThreshold);
      }

      window.state.config.clickAssist = clickAssist ? true : false;
      console.log(`Click Assist: ${clickAssist ? 'ON' : 'OFF'}`);
      if (typeof clickTimeout === 'number') {
        window.state.config.clickAssistTimeout = clickTimeout;
        console.log(`Click Assist Timeout: ${clickTimeout}ms`);
      }
      if (typeof clickRadius === 'number') {
        window.state.config.clickAssistRadius = clickRadius;
        console.log(`Click Assist Radius: ${clickRadius}px`);
      }

      window.state.config.dwellClick = dwellClick ? true : false;
      console.log(`Dwell Click: ${dwellClick ? 'ON' : 'OFF'}`);
      if (typeof dwellTime === 'number') {
        window.state.config.dwellTime = dwellTime;
        console.log(`Dwell Time: ${dwellTime}ms`);
      }
      if (typeof dwellArea === 'number') {
        window.state.config.dwellArea = dwellArea;
        console.log(`Dwell Area: ${dwellArea}px`);
      }
    });

})();
