// src/content/state.js

window.initializeState = function () {
  if (typeof window !== 'undefined' && !window.state) {
    window.state = {
      // ms between allowed clicks
      CLICK_COOLDOWN: 1000,

      // Head-tracking cursor
      sprite: null,

      // Calibration state
      readyToTrack: false,

      // Wait state (disable/enable cursor click)
      loading: false,

      // Tabstrip state
      tabstrip: null, // "open" | "inactive" | "closing" | "reopen" | null

      // Configuration state
      configInit: false,

      // Application configuration
      config: {
        coordinateSystem: "2d",
        landmarkPoints: "3", // Default to 3 points
        filterType: "exponential",
        exponentialSmoothingFactor: 0.9025, // 0.95 ** 2
        scrolling: {
          thresholdMs: 1000, // ms dwell before scrolling
          speedUp: 10, // px per interval when at top
          speedDown: 10, // px per interval when at bottom
          intervalMs: 16, // ~60fps scroll interval
        },
        actions: {
          click: "smile",
          clickThreshold: 0.8,
        },
        clickAssist: false,
        clickAssistTimeout: 2000,
        clickAssistRadius: 100,

        dwellClick: false,
        dwellTime: 1000, // ms dwell before clicking
        dwellArea: 15 // px dwell movement threshold
      },

      // Transformation matrices for all configurations (2D/3D, 3/6 facial landmarks)
      transformationMatrices: {
        threePoint2d: null,
        sixPoint2d: null,
        threePoint3d: null,
        sixPoint3d: null,
      },

      // Calibration width and height
      calibrationWidth: null,
      calibrationHeight: null,

      // Cursor tracking state
      lastHeadX: null,
      lastHeadY: null,
      cursorX: null,
      cursorY: null,

      // Last click time
      lastClickTime: 0,

      // Click-assist state
      activeInteractiveEl: null,
      anchorX: null,
      anchorY: null,
      lockStartTime: null,

      // Dwell-click state
      dwellAnchorX: null,
      dwellAnchorY: null,

      // Edge-scrolling state
      boundaryTimer: null,
      scrollInterval: null,
      lastBoundary: null, // "top" | "bottom" | null
    };
    console.log("running state.js....window.state has been initialized!");
  }
}
