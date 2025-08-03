// state.js
window.initializeState = function () {
  if (typeof window !== 'undefined' && !window.state) {
    window.state = {
      // Landmarks data
      lastLandmarks: null,

      // Calibration state
      readyToTrack: false,

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
        clickAssistRadius : 100,
        dwellClick: false,
        dwellTime: 1000, // ms dwell before clicking
        dwellArea: 15 // px dwell movement threshold
      },

      // Calibration data for both 3 and 6 point systems
      calibrationData: {
        landmarkPoints3: [],
        landmarkPoints6: [],
        cursorPositions: [],
        allPoints: [],
        calibrationWidth: null,
        calibrationHeight: null, 
      },

      // Transformation matrices for both configurations
      transformationMatrices: {
        threePoint: null,
        sixPoint: null,
        threePoint2d: null,
        sixPoint2d: null,
        threePoint3d: null,
        sixPoint3d: null,
      },

      // Cursor tracking state
      lastHeadX: null,
      lastHeadY: null,
      cursorX: null,
      cursorY: null,

      // Calculated residuals
      calculatedResiduals: null,

    };
    console.log("running state.js....window.state has been initialized!");
  }
}
