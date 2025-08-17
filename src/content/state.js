// state.js
window.initializeState = function () {
  if (typeof window !== 'undefined' && !window.state) {
    window.state = {
      // Calibration state
      readyToTrack: false,

      // Tabstrip state
      tabstrip: null, // "open" | "inactive" | "closing" | "reopen" | null

      // Configuration state
      configInit: false,

      // Application configuration
      config: {
        coordinateSystem: "2d",
        landmarkPoints: "3", // Default to 3 points
        filterType: "exponential",
        exponentialSmoothingFactor: 0.95,
        scrolling: {
          thresholdMs: 1000, // ms dwell before scrolling
          speedUp: 10, // px per interval when at top
          speedDown: 10, // px per interval when at bottom
          intervalMs: 16, // ~60fps scroll interval
        },
        actions: {
          click: "browUp", // "smile" | "browUp" | "jawOpen"
          clickThreshold: 0.8,
        },
        clickAssist: false,
        clickAssistTimeout: 1000,
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

      // Edge-scrolling state
      boundaryTimer: null,
      scrollInterval: null,
      lastBoundary: null, // "top" | "bottom" | null
    };
    console.log("running state.js....window.state has been initialized!");
  }
}
