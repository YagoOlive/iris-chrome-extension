// Initialize filters when starting tracking
function initializeFilters() {
  // Get parameters from state or use defaults
  const config = {
    frequency: state.filterConfig?.frequency || 60,
    minCutoff: state.filterConfig?.minCutoff || 1.5,
    beta: state.filterConfig?.beta || 0.007,
    dcutoff: state.filterConfig?.dcutoff || 1.0,
  };

  state.filterConfig = config;

  // Use same parameters for both X and Y
  state.xFilter = new OneEuroFilter(
    config.frequency,
    config.minCutoff,
    config.beta,
    config.dCutoff
  );

  state.yFilter = new OneEuroFilter(
    config.frequency,
    config.minCutoff,
    config.beta,
    config.dCutoff
  );

  if (state.lastHeadX !== null) {
    const timestamp = performance.now() / 1000;
    state.xFilter.filter(state.lastHeadX, timestamp);
    state.yFilter.filter(state.lastHeadY, timestamp);
  }
}

const cursorSize = 20; // Adjust this value based on your cursor's actual size in pixels

function updateCursor() {
  if (state.isTracking && state.lastLandmarks) {
    try {
      // Get current landmark configuration
      const currentConfig = state.config.landmarkPoints;
      const is3D = state.config.coordinateSystem === "3d";
      const landmarks = state.lastLandmarks;

      // Define landmark indices
      const indices = currentConfig === "3" ? [1, 33, 263] : [1, 61, 291, 152, 33, 263];
      const quadraticScale = 0.00001;
      
      // Create vector with proper format based on mode
      let vector = [];
      
      // Simplified vector creation based on mode
      if (is3D) {
        // 3D mode - use x, y, z coordinates
        for (const index of indices) {
          const landmark = landmarks[index];
          if (!landmark) continue;
          
          const x = landmark.x * window.innerWidth;
          const y = landmark.y * window.innerHeight;
          const z = landmark.z ? landmark.z * 1000 : 0; // Default to 0 if z is missing
          
          vector.push([x]);
          vector.push([y]);
          vector.push([z]);
          vector.push([x * x * quadraticScale]);
          vector.push([y * y * quadraticScale]);
          vector.push([z * z * quadraticScale]);
        }
        
        // Select 3D matrix
        const matrix = currentConfig === "3" ? 
          state.transformationMatrices.threePoint3d : 
          state.transformationMatrices.sixPoint3d;
        
        if (!matrix) {
          console.error("No 3D transformation matrix available");
          return;
        }
        
        // Verify vector dimensions
        const expectedLength = currentConfig === "3" ? 18 : 36;
        if (vector.length !== expectedLength) {
          console.error(`3D vector has wrong length: ${vector.length}, expected: ${expectedLength}`);
          return;
        }
        
        // Calculate cursor position with 3D matrix
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
          console.error("Matrix multiplication error in 3D mode:", error);
        }
      } 
      else {
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
          console.error("No 2D transformation matrix available");
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
    } catch (error) {
      console.error("Error updating cursor:", error);
    }
  }
  requestAnimationFrame(updateCursor);
}

// Helper function for applying filtering and updating cursor position
function applyFilteringAndUpdateCursor(headPositionX, headPositionY) {
  // Apply filtering based on selected filter type
  if (state.config.filterType === "oneEuro") {
    const timestamp = performance.now() / 1000;

    // Initialize filters if needed
    if (!state.xFilter || !state.yFilter) {
      state.lastHeadX = headPositionX;
      state.lastHeadY = headPositionY;
      initializeFilters();
      return;
    }

    // Apply 1€ filter
    const filteredX = state.xFilter.filter(headPositionX, timestamp);
    const filteredY = state.yFilter.filter(headPositionY, timestamp);

    // Smooth movement
    if (state.cursorX === null) {
      state.cursorX = filteredX;
      state.cursorY = filteredY;
    } else {
      const smoothingFactor = 0.1; // Between old and new values
      state.cursorX += (filteredX - state.cursorX) * smoothingFactor;
      state.cursorY += (filteredY - state.cursorY) * smoothingFactor;
    }

    // Add rounding here like in old version
    const roundedX = Math.round(state.cursorX);
    const roundedY = Math.round(state.cursorY);
    updateCursorPosition(roundedX, roundedY);
  } else {
    // Exponential smoothing
    if (state.lastHeadX === null) {
      state.lastHeadX = headPositionX;
      state.cursorX = headPositionX;
      state.rawCursorX = headPositionX;
    }
    if (state.lastHeadY === null) {
      state.lastHeadY = headPositionY;
      state.cursorY = headPositionY;
      state.rawCursorY = headPositionY;
    }

    // Get cursor element
    let cursorWithClipping = document.getElementById("head-cursor-clipped");

    if (!cursorWithClipping) {
      console.error("Cursor element not found");
      return;
    }

    // Apply direct exponential smoothing without relative movements
    const smoothing = state.config.exponentialSmoothingFactor || 0.95; // Uses configurable value
    
    // Apply smoothing directly to cursor position
    if (state.cursorX === null) {
      state.cursorX = headPositionX;
      state.cursorY = headPositionY;
    } else {
      // Direct exponential smoothing
      state.cursorX = state.cursorX + (1 - smoothing) * (headPositionX - state.cursorX);
      state.cursorY = state.cursorY + (1 - smoothing) * (headPositionY - state.cursorY);
    }

    // Apply bounds
    const cursorSize = 20;
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
  }

  // Update last positions
  state.lastHeadX = headPositionX;
  state.lastHeadY = headPositionY;
}

function updateCursorPosition(x, y) {
  const cursorSize = 20; // Size of cursor in pixels

  // Create or get cursor element (only need the clipped one now)
  let cursorWithClipping = document.getElementById("head-cursor-clipped");
  if (!cursorWithClipping) {
    cursorWithClipping = document.createElement("div");
    cursorWithClipping.id = "head-cursor-clipped";
    cursorWithClipping.style.position = "fixed";
    cursorWithClipping.style.width = `${cursorSize}px`;
    cursorWithClipping.style.height = `${cursorSize}px`;
    cursorWithClipping.style.borderRadius = "50%";
    cursorWithClipping.style.backgroundColor = "red";
    cursorWithClipping.style.zIndex = "1000";
    cursorWithClipping.style.pointerEvents = "none";
    cursorWithClipping.style.transform = "translate(-50%, -50%)";
    document.body.appendChild(cursorWithClipping);
  }

  // Apply positions
  const boundedX = Math.max(0, Math.min(window.innerWidth - cursorSize, x));
  const boundedY = Math.max(0, Math.min(window.innerHeight - cursorSize, y));

  cursorWithClipping.style.left = `${boundedX}px`;
  cursorWithClipping.style.top = `${boundedY}px`;
}

// Initialize cursors for tracking
function initializeCursors() {
  // Create cursor elements if they don't exist
  if (!document.getElementById("head-cursor-raw")) {
    updateCursorPosition(window.innerWidth / 2, window.innerHeight / 2);
  }
  
  // Create reference grid if enabled
  if (state.config.showReferenceGrid) {
    createReferenceGrid();
  }
}
