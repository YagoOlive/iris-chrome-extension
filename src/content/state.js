// src/content/state.js

(() => {
  function initializeState() {
    if (typeof window === 'undefined') return;
    // Só cria se não existir — o reset explícito é feito pelo tracker quando necessário
    if (window.state) return;
    window.state = {
      CLICK_COOLDOWN: 1000,
      sprite: null,
      readyToTrack: false,
      loading: false,
      configInit: false,
      config: {
        coordinateSystem: "2d",
        landmarkPoints: "3",
        filterType: "exponential",
        exponentialSmoothingFactor: 0.9025,
        scrolling: {
          thresholdMs: 1000,
          speedUp: 10,
          speedDown: 10,
          intervalMs: 16,
        },
        cursorSprite: 'arrow',
        actions: {
          click: "smile",
          clickThreshold: 0.8,
          doubleClick: "",
          doubleClickThreshold: 1.0,
          rightClick: "",
          rightClickThreshold: 0.8,
        },
        clickAssist: false,
        clickAssistTimeout: 1000,
        clickAssistRadius: 100,
        dwellClick: false,
        dwellTime: 3000,
        dwellArea: 15,
      },
      transformationMatrices: {
        threePoint2d: null,
        sixPoint2d: null,
        threePoint3d: null,
        sixPoint3d: null,
      },
      calibrationWidth: null,
      calibrationHeight: null,
      lastHeadX: null,
      lastHeadY: null,
      cursorX: null,
      cursorY: null,
      lastClickTime: 0,
      activeInteractiveEl: null,
      anchorX: null,
      anchorY: null,
      lockStartTime: null,
      dwellAnchorX: null,
      dwellAnchorY: null,
      boundaryTimer: null,
      scrollInterval: null,
      lastBoundary: null,
    };
    console.log("window.state initialized.");
  }

  // Reseta apenas os campos de runtime, preservando config e matrizes
  function resetRuntimeState() {
    if (!window.state) { initializeState(); return; }
    window.state.sprite = null;
    window.state.readyToTrack = false;
    window.state.loading = false;
    window.state.configInit = false;
    window.state.lastHeadX = null;
    window.state.lastHeadY = null;
    window.state.cursorX = null;
    window.state.cursorY = null;
    window.state.lastClickTime = 0;
    window.state.activeInteractiveEl = null;
    window.state.anchorX = null;
    window.state.anchorY = null;
    window.state.lockStartTime = null;
    window.state.dwellAnchorX = null;
    window.state.dwellAnchorY = null;
    window.state.boundaryTimer = null;
    window.state.scrollInterval = null;
    window.state.lastBoundary = null;
  }

  window.HTState = { initializeState, resetRuntimeState };
})();
