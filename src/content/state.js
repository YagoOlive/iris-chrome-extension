// state.js

window.initializeState = function() {
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
      },

      // Calibration data for both 3 and 6 point systems
      calibrationData: {
        landmarkPoints3: [],
        landmarkPoints6: [],
        cursorPositions: [],
        allPoints: [],
      },

      // Transformation matrices for both configurations
      transformationMatrices: {
        threePoint: null,
        sixPoint: null
      },

      // Cursor tracking state
      lastHeadX: null,
      lastHeadY: null,
      cursorX: null,
      cursorY: null,
      lastRawX: null,
      lastRawY: null,
    };
    console.log("running state.js....window.state has been initialized!");
  }
}
