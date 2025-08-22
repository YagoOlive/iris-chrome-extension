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

  const CLICK_COOLDOWN = 1000; // ms between allowed clicks

  // Show the dwell ring only after this fraction of dwellTime has elapsed
  const DWELL_VISUAL_THRESHOLD = 0.40;

  const TOP_TRIGGER_PX = 0; // tabstrip top edge trigger zone
  const TABSTRIP_KEEP_ALIVE_PX = 112 // tabstrip remains open if cursor dwells within 112px of the top boundary
  const TABSTRIP_HIDE_DELAY = 2000; // ms until the tabstrip hides after leaving the keep alive zone

  let sprite = null;
  let port = null;
  let inner = null;
  let notch = null;

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

  let waitRing = null;
  let waitTrack = null;

  // Create element to remove/restore the default cursor
  const style = document.createElement('style');
  // Append it into <head> (or document.documentElement for document_start)
  (document.head || document.documentElement).appendChild(style);

  function createWaitRing() {
    if (waitRing) return;

    waitRing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    waitRing.setAttribute("class", "wait-ring");
    waitRing.setAttribute("viewBox", "0 0 18 18");
    waitRing.style.overflow = 'visible';

    waitTrack = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    waitTrack.setAttribute("class", "wait-track");
    waitTrack.setAttribute("cx", "9");
    waitTrack.setAttribute("cy", "9");
    waitTrack.setAttribute("r", "4");

    const spinningArc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    spinningArc.setAttribute("class", "spinner");
    spinningArc.setAttribute("cx", "9");
    spinningArc.setAttribute("cy", "9");
    spinningArc.setAttribute("r", "4");

    waitRing.appendChild(waitTrack);
    waitRing.appendChild(spinningArc);
    sprite.appendChild(waitRing);
  }

  function showWait() {
    sprite?.classList.add('is-waiting');
    window.state.loading = true;
  }

  function hideWait() {
    sprite?.classList.remove('is-waiting');
    window.state.loading = false;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hideWait();
  });

  // Expose a tiny API for the tabstrip/content code
  window.HTCursor = { showWait, hideWait };

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
    if (clamped > 0.75) {
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
    createWaitRing();

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
    createSprite();
    hideWait();
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
    // style.textContent = `
    //   html, body, * {
    //     cursor: none !important;
    //   }
    // `;
  }

  console.log('Head-tracking content script injected and state initialized.');

  function handlePacket({ landmarks, blends }) {

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

  // --- Click synthesis that behaves like a human click (crossing shadow DOM) ---
  function dispatchPointer(type, x, y, target) {
    const ev = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: x,
      clientY: y,
      buttons: type === 'pointerdown' ? 1 : 0,
    });
    return target.dispatchEvent(ev);
  }

  function dispatchMouse(type, x, y, target) {
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0
    });
    return target.dispatchEvent(ev);
  }

  /**
   * Simulate a "real" left click: pointerdown → mousedown → pointerup → mouseup → click.
   * Returns true if the final click's default was NOT prevented.
   */
  function synthesizeHumanClick(target, x, y) {
    // order matters
    dispatchPointer('pointerover', x, y, target);
    dispatchMouse('mouseover', x, y, target);
    dispatchPointer('pointerenter', x, y, target);
    dispatchMouse('mouseenter', x, y, target);

    dispatchPointer('pointerdown', x, y, target);
    dispatchMouse('mousedown', x, y, target);
    dispatchPointer('pointerup', x, y, target);
    dispatchMouse('mouseup', x, y, target);

    const clickEv = new MouseEvent('click', {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: x, clientY: y, button: 0
    });
    return target.dispatchEvent(clickEv); // false => defaultPrevented
  }

  function cursorClick(candidateEl) {
    if (!candidateEl || state.loading) return;

    // Inputs need focus first
    const tag = candidateEl.tagName?.toLowerCase?.();
    if (tag === 'textarea' || tag === 'input') {
      candidateEl.focus();
    }

    // use HTMLElement.click() function or synthesizeHumanClick() function
    // candidateEl.click();
    synthesizeHumanClick(candidateEl, state.cursorX, state.cursorY);

    lastClickTime = Date.now();
    showDwellRing(false);
    dwellAnchorX = null;
    dwellAnchorY = null;
  }

  // Returns the deepest element at (x,y), descending into any shadow roots.
  function elementFromPointDeep(x, y, root = document) {
    let el = root.elementFromPoint(x, y);
    // Descend through nested shadow roots, if any
    while (el && el.shadowRoot) {
      const next = el.shadowRoot.elementFromPoint(x, y);
      if (!next || next === el) break;
      el = next;
    }
    return el;
  }


  // ----- Click on facial expression ----------------------------------------------------
  function maybeClick(score) {
    const now = Date.now();
    if (score < state.config.actions.clickThreshold) return;
    if (now - lastClickTime < CLICK_COOLDOWN) return;

    // ① find element under the virtual cursor
    const candidate = elementFromPointDeep(state.cursorX, state.cursorY);
    let el = nearestInteractive(candidate);

    if (state.config.clickAssist && activeInteractiveEl) {
      const dx = state.cursorX - anchorX;
      const dy = state.cursorY - anchorY;
      if (Math.hypot(dx, dy) <= state.config.clickAssistRadius && now - lockStartTime < state.config.clickAssistTimeout) {
        el = activeInteractiveEl; // honor the lock
      }
    }
    cursorClick(el);
  }

  function startDwell() {
    dwellAnchorX = state.cursorX;
    dwellAnchorY = state.cursorY;
    dwellStartTime = Date.now();
    showDwellRing(false);
    setDwellProgress(0);
  }

  function handleDwellClick() {
    if (!state.config.dwellClick || !window.state.readyToTrack || state.boundaryTimer || state.loading) {
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

    // At/above threshold → show and map to [0..1] over remaining time
    if (p >= DWELL_VISUAL_THRESHOLD) {
      const q = (p - DWELL_VISUAL_THRESHOLD) / (1 - DWELL_VISUAL_THRESHOLD);
      showDwellRing(true);
      setDwellProgress(q);
    }

    if (p >= 1) {
      const candidate = elementFromPointDeep(state.cursorX, state.cursorY);
      let el = nearestInteractive(candidate);
      cursorClick(el);
    }
  }

  const INTERACTIVE_SEL =
    'a[href], button, input, select, textarea, label, [role="button"], [onclick]';

  function nearestInteractive(el) {
    if (!el) return null;
    const close = el.closest('.ht-close-hit'); // Edge Case #1: Hovering over close button on a tab
    if (close) return close; // promote close target above the tab button
    return el.closest(INTERACTIVE_SEL) || el; // falls back to the raw element
  }

  function recordLock() {
    anchorX = state.cursorX;
    anchorY = state.cursorY;
    lockStartTime = Date.now();
  }

  // ----- Hover-Effect ----------------------------------------------------
  function updateHover() {
    if (state.loading) return;
    const candidate = elementFromPointDeep(state.cursorX, state.cursorY);
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

        // Edge Case: If the pointer is over the .ht-close-hit button, prioritize switching into it.
        if (candidateInteractive?.matches?.('.ht-close-hit') && now - lockStartTime > 250) {
          activeInteractiveEl = candidateInteractive;
          recordLock();
          el = activeInteractiveEl;
        } else {
          const dx = state.cursorX - anchorX;
          const dy = state.cursorY - anchorY;
          if (Math.hypot(dx, dy) <= state.config.clickAssistRadius && now - lockStartTime < state.config.clickAssistTimeout) {
            el = activeInteractiveEl; // stay locked
          } else {
            activeInteractiveEl = null; // radius broken ⇒ unlock
          }
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

    updateHover();
    handleDwellClick();

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
    window.state.configInit = false;
    window.HTTabstrip?.hide?.(0);
    window.HTTabstrip?.destroy?.();
    // style.textContent = `
    //   html, body, * {
    //     cursor: auto !important;
    //   }
    // `;
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
        lastClickTime = Date.now();
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
      lastClickTime = Date.now();
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
    lastClickTime = Date.now();
  });

  //  --- SETTINGS ---
  chrome.storage.local.get(
    ['exponentialSmoothingFactor', 'clickAction', 'clickAssist', 'clickTimeout', 'clickRadius',
      'dwellClick', 'dwellTime', 'dwellArea'],
    (items) => {
      initSettings(items);
    });

})();
