// public/content/tracker.js

import * as math from 'mathjs';

import { controlScroll, stopScroll } from './scroll';
import { initSettings, updateSettings } from './settings';
import getClickScore from './click-score';

// Use an IIFE to avoid polluting the global scope and run immediately
(() => {
  // Prevent double-injection
  if (window.__htCursorInjected) return;
  window.__htCursorInjected = true;

  // Call the initializer from state.js immediately
  initializeState();

  const TOP_TRIGGER_PX = 0; // tabstrip top edge trigger zone
  const TABSTRIP_KEEP_ALIVE_PX = 112 // tabstrip remains open if cursor dwells within 112px of the top boundary
  const TABSTRIP_HIDE_DELAY = 2000; // ms until the tabstrip hides after leaving the keep alive zone

  let port = null;

  // Create element to remove/restore the default cursor
  const style = document.createElement('style');
  // Append it into <head> (or document.documentElement for document_start)
  (document.head || document.documentElement).appendChild(style);

  /* Life-cycle helpers */
  function connectPort() {
    if (port) return;
    port = chrome.runtime.connect({ name: 'pose' });
    port.onMessage.addListener(handlePacket);
    port.onDisconnect.addListener(() => (port = null));
  }

  function initConfig(config) {
    if (state.configInit) return;
    window.state.config.coordinateSystem = config.coordinateSystem;
    window.state.config.landmarkPoints = config.landmarkPoints;
    window.state.config.filterType = config.filterType;
    window.state.calibrationWidth = config.calibrationWidth;
    window.state.calibrationHeight = config.calibrationHeight;
    window.state.transformationMatrices.threePoint2d = config.threePoint2d;
    window.state.transformationMatrices.sixPoint2d = config.sixPoint2d;
    window.state.transformationMatrices.threePoint3d = config.threePoint3d;
    window.state.transformationMatrices.sixPoint3d = config.sixPoint3d;
    window.state.configInit = true;
  }

  function startTracking(config) {
    window.HTCursor?.createSprite();
    window.HTCursor?.hideWait();
    connectPort();
    initConfig(config);
    // If background requested a sticky-open (e.g., after tab-switch/new tab)
    chrome.storage.local.get(['tabstripForceOpen'], ({ tabstripForceOpen }) => {
      if (tabstripForceOpen) {
        window.HTTabstrip?.show(false);
        state.tabstrip = "open";
        chrome.storage.local.remove('tabstripForceOpen'); // clear the flag so it doesn't keep opening on later pages
      } else {
        // normal behavior: brief peek, then hide
        window.HTTabstrip?.show();
        window.HTTabstrip?.hide?.(TABSTRIP_HIDE_DELAY);
      }
    });
    window.state.readyToTrack = true;
  }

  console.log('Head-tracking content script injected and state initialized.');

  function handlePacket({ landmarks, blends }) {

    if (!window.state.readyToTrack) {
      console.log("Not yet ready....");
      return;
    }

    window.HTClick?.maybeClick(getClickScore(blends));

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
      const calibrationWidth = state.calibrationWidth || window.innerWidth;
      const calibrationHeight = state.calibrationHeight || window.innerHeight;

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
        headPositionX * (window.innerWidth / state.calibrationWidth),
        headPositionY * (window.innerHeight / state.calibrationHeight)
      );
    } catch (error) {
      console.error("Matrix multiplication error in 2D mode:", error);
    }
  }

  // Helper function for applying filtering and updating cursor position
  function applyFilteringAndUpdateCursor(headPositionX, headPositionY) {
    // Exponential smoothing
    if (state.lastHeadX === null) {
      window.state.lastHeadX = headPositionX;
      window.state.cursorX = headPositionX;
    }
    if (state.lastHeadY === null) {
      window.state.lastHeadY = headPositionY;
      window.state.cursorY = headPositionY;
    }

    // Get cursor element
    let cursorWithClipping = state.sprite;

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

    // Dynamic-Tabstrip trigger
    if ((!state.tabstrip && roundedY <= TOP_TRIGGER_PX) ||
      ((state.tabstrip === "inactive") && roundedY <= TABSTRIP_KEEP_ALIVE_PX)) {
      window.HTTabstrip?.show();
      state.tabstrip = "open";
    } else if (state.tabstrip === "open" && roundedY > TABSTRIP_KEEP_ALIVE_PX) {
      state.tabstrip = "inactive";
      window.HTTabstrip?.hide(TABSTRIP_HIDE_DELAY);
    } else if (state.tabstrip === "closing" && roundedY <= TABSTRIP_KEEP_ALIVE_PX) {
      state.tabstrip = "reopen";
      window.HTTabstrip?.show();
    }

    window.HTHover?.updateHover();
    window.HTDwellClick?.handleDwellClick();

    // Edge-scrolling logic
    controlScroll(cursorSize);

    // Update last positions
    state.lastHeadX = headPositionX;
    state.lastHeadY = headPositionY;
  }

  // --- TEARDOWN ---
  function stopTracking() {
    console.log('Cleaning up tracker script on this page.');
    stopScroll();
    window.state.readyToTrack = false;
    port?.disconnect(); // Close the connection to the background script
    port = null;
    window.HTCursor?.destroySprite();
    window.HTDwellClick?.destroyDwellRing();
    window.__htCursorInjected = false;
    window.state.configInit = false;
    window.HTTabstrip?.hide?.(0);
    window.HTTabstrip?.destroy?.();
  }

  // --- MESSAGE LISTENER ---
  const messageListener = (msg, sender, sendResponse) => {
    switch (msg.cmd) {
      case 'PING':
        return sendResponse({ ok: true }); // lets background know we’re injected
      case 'START_TRACKING':
        startTracking(msg.config);
        return sendResponse({ ok: true });
      case 'STOP_TRACKING':
        stopTracking();
        return sendResponse({ ok: true });
      case 'UPDATE_SETTINGS':
        updateSettings(msg);
        return sendResponse({ ok: true });
      case 'GLOBAL_CLICK_SUPPRESS':
        window.state.lastClickTime = Date.now();
        return sendResponse({ ok: true });
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // --- BFCache / history navigation handling ---
  // If the page is restored from BFCache, ports are closed and content scripts
  // don't re-execute. Use pageshow to reconnect and restart tracking.
  window.addEventListener('pageshow', (e) => {
    // Back/forward restore or a BFCache restore (persisted = true)
    const nav = performance.getEntriesByType('navigation')[0];
    console.log(e);
    console.log(nav);
    const isBackForward =
      (nav && nav.type === 'back_forward') || e.persisted === true;

    if (isBackForward) {
      window.state.lastClickTime = Date.now();
      chrome.storage.local.get(['config'], ({ config }) => {
        stopTracking();
        if (config) startTracking(config);
      });
    }
  });

  window.addEventListener('pagehide', (e) => {
    if (e.persisted) {      
      window.state.readyToTrack = false;
    }
  });


  // --- INITIALIZATION ---
  chrome.storage.local.get(['config'], ({ config }) => {
    if (config) {
      startTracking(config);
    } else {
      console.error('Could not find calibration data in storage. Stopping.');
      stopTracking();
    }
    window.state.lastClickTime = Date.now();
  });

  //  --- SETTINGS ---
  chrome.storage.local.get(
    ['exponentialSmoothingFactor', 'clickAction', 'clickAssist', 'clickTimeout', 'clickRadius',
      'dwellClick', 'dwellTime', 'dwellArea'],
    (items) => {
      initSettings(items);
    });

})();
