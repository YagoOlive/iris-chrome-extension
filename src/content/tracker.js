// src/content/tracker.js

import * as math from 'mathjs';

import { controlScroll, stopScroll } from './scroll';
import { initSettings, updateSettings } from './settings';
import getClickScore, { getGestureScore } from './click-score';

// Use an IIFE to avoid polluting the global scope and run immediately
(() => {
  // Prevent double-injection — mas esta flag é resetada antes de cada reinício
  if (window.__htCursorInjected) return;
  window.__htCursorInjected = true;

  // Inicializar estado limpo
  window.HTState.initializeState();

  let port = null;

  let scaleX = 1;
  let scaleY = 1;

  function recomputeScale() {
    const w = window.innerWidth, h = window.innerHeight;
    scaleX = state.calibrationWidth ? (w / state.calibrationWidth) : 1;
    scaleY = state.calibrationHeight ? (h / state.calibrationHeight) : 1;
  }

  window.addEventListener('resize', () => { recomputeScale(); });

  /* Life-cycle helpers */
  let reconnectTimer = null;

  function connectPort() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (port) return;
    try {
      port = chrome.runtime.connect({ name: 'pose' });
    } catch {
      // Contexto da extensão invalidado (ex.: extensão recarregada) — desiste.
      return;
    }
    port.onMessage.addListener(handlePacket);
    port.onDisconnect.addListener(() => {
      port = null;
      // O service worker pode ter sido reciclado. Enquanto o rastreamento
      // estiver ativo nesta página, reconecta para retomar o fluxo de landmarks.
      if (window.state?.readyToTrack && !reconnectTimer) {
        reconnectTimer = setTimeout(connectPort, 250);
      }
    });
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
    recomputeScale();
    window.state.configInit = true;
  }

  function startTracking(config) {
    // Reset apenas os campos de runtime — preserva config e matrizes já carregados
    window.HTState.resetRuntimeState();

    window.HTCursor?.destroySprite();
    port?.disconnect();
    port = null;

    window.HTCursor?.createSprite();
    window.HTCursor?.hideWait();
    connectPort();
    initConfig(config);
    window.state.readyToTrack = true;
  }

  console.log('Head-tracking content script injected and state initialized.');

  function handlePacket({ landmarks, blends }) {
    if (!window.state.readyToTrack) {
      console.log("Not yet ready....");
      return;
    }

    window.HTClick?.maybeClick(getClickScore(blends));
    const doubleClickScore = getGestureScore(state.config.actions.doubleClick, blends);
    window.HTClick?.maybeDoubleClick?.(doubleClickScore);
    const rightClickScore = getGestureScore(state.config.actions.rightClick, blends);
    window.HTClick?.maybeRightClick?.(rightClickScore);

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
        headPositionX * scaleX,
        headPositionY * scaleY
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

    // Apply direct exponential smoothing without relative movements
    let smoothing = state.config.exponentialSmoothingFactor || 0.9025;

    // Apply smoothing directly to cursor position
    if (state.cursorX === null) {
      window.state.cursorX = headPositionX;
      window.state.cursorY = headPositionY;
    } else {
      window.state.cursorX = state.cursorX + (1 - smoothing) * (headPositionX - state.cursorX);
      window.state.cursorY = state.cursorY + (1 - smoothing) * (headPositionY - state.cursorY);
    }

    // Apply bounds
    const cursorSize = 24;
    state.cursorX = Math.max(0, Math.min(window.innerWidth - cursorSize, state.cursorX));
    state.cursorY = Math.max(0, Math.min(window.innerHeight - cursorSize, state.cursorY));

    // Round for display
    const roundedX = Math.round(state.cursorX);
    const roundedY = Math.round(state.cursorY);

    const t = `translate3d(${roundedX}px, ${roundedY}px, 0)`;
    if (state.sprite.style.transform !== t) state.sprite.style.transform = t;

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
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    port?.disconnect();
    port = null;
    window.HTCursor?.destroySprite();
    window.HTDwellClick?.destroyDwellRing();
    window.HTHover?.destroyHighlight();
    window.__htCursorInjected = false;
    window.state.configInit = false;
  }

  // --- BFCACHE LIFECYCLE ---
  window.addEventListener('pageshow', async (e) => {
    if (!e.persisted) return;
    console.log('Head-tracking: página restaurada do bfcache — reiniciando.');
    const { isTrackingActive, config } = await chrome.storage.local.get(['isTrackingActive', 'config']);
    if (!isTrackingActive || !config) return;

    // Reset de runtime sem perder config/matrizes
    window.__htCursorInjected = false;
    window.HTState.resetRuntimeState();
    window.__htCursorInjected = true;
    port?.disconnect();
    port = null;

    chrome.storage.local.get(
      ['exponentialSmoothingFactor', 'cursorSprite', 'clickAction', 'doubleClickAction',
        'rightClickAction', 'clickAssist', 'clickTimeout', 'clickRadius',
        'dwellClick', 'dwellTime', 'dwellArea'],
      (items) => {
        initSettings(items);
        startTracking(config);
      }
    );
  });

  window.addEventListener('pagehide', (e) => {
    if (!e.persisted) return;
    console.log('Head-tracking: página congelando no bfcache — fazendo teardown.');
    stopTracking();
    window.__htCursorInjected = false;
  });

  // --- MESSAGE LISTENER ---
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.cmd === 'PING') {
      sendResponse({ ok: true });
    } else if (msg.cmd === 'START_TRACKING') {
      chrome.storage.local.get(
        ['exponentialSmoothingFactor', 'cursorSprite', 'clickAction', 'doubleClickAction',
          'rightClickAction', 'clickAssist', 'clickTimeout', 'clickRadius',
          'dwellClick', 'dwellTime', 'dwellArea'],
        (items) => {
          initSettings(items);
          // Idempotente: se já estamos rastreando com o sprite e a porta vivos,
          // apenas garante a conexão — não derruba/reconstrói tudo a cada
          // sinal repetido (onUpdated + ENSURE_TRACKING + START_TRACKING).
          if (window.state.readyToTrack && window.state.sprite?.isConnected) {
            connectPort();
          } else {
            startTracking(msg.config);
          }
        }
      );
      sendResponse({ ok: true });
    } else if (msg.cmd === 'STOP_TRACKING') {
      stopTracking();
      sendResponse({ ok: true });
    } else if (msg.cmd === 'UPDATE_SETTINGS') {
      updateSettings(msg);
      sendResponse({ ok: true });
    }
  });
})();
