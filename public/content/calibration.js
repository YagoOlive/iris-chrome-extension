// Handle user-uploaded calibration (.csv) file
function handleCalibrationUpload(text) {
  try {
    console.log("Starting calibration file upload.");

    console.log(typeof(text));
    console.log(text);

    // Extract metadata from first line
    const lines = text.split('\n');
    let metadata = {};

    if (!lines || !lines.length) {
      throw new Error("Empty file.");
    }

    if (lines[0].startsWith('#')) {
      try {
        metadata = JSON.parse(lines[0].substring(1));
        console.log("Parsed metadata:", metadata);
        lines.shift();
      } catch (e) {
        console.warn("Failed to parse metadata:", e);
      }
    }

    const result = Papa.parse(lines.join('\n'), {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transform: (value) => {
        if (typeof value === 'number') {
          return Number(value.toFixed(8));
        }
        return value;
      }
    });

    if (!result.data || !result.data.length) {
      throw new Error("No data found in CSV file.");
    }

    console.log("Current Configuration:", state.config);

    // Process the calibration data
    const processedData = processCalibrationData(result.data, state.config);

    // Update state with processed data
    state.calibrationData = processedData;

    // Always calculate all matrices for both coordinate systems and point configurations
    console.log("Pre-calculating all transformation matrices...");

    // First calculate matrices for the file's native coordinate system
    const nativeCoordinateSystem = config.coordinateSystem;
    console.log(`Calculating matrices for native coordinate system: ${nativeCoordinateSystem}`);

    // Calculate matrices in the native mode
    state.transformationMatrices = {
      threePoint: calculateTransformationMatrixForConfig(
        processedData.landmarkPoints3,
        processedData.cursorPositions,
        "3"
      ),
      sixPoint: calculateTransformationMatrixForConfig(
        processedData.landmarkPoints6,
        processedData.cursorPositions,
        "6"
      )
    };

    // Store in coordinate-system-specific locations
    if (nativeCoordinateSystem === "2d") {
      state.transformationMatrices.threePoint2d = state.transformationMatrices.threePoint;
      state.transformationMatrices.sixPoint2d = state.transformationMatrices.sixPoint;

      // Now calculate 3D matrices
      console.log("Pre-calculating 3D matrices...");

      // Temporarily switch to 3D mode for calculation
      config.coordinateSystem = "3d";
      state.config.coordinateSystem = "3d";

      try {
        state.transformationMatrices.threePoint3d = calculateTransformationMatrixForConfig(
          processedData.landmarkPoints3,
          processedData.cursorPositions,
          "3"
        );

        state.transformationMatrices.sixPoint3d = calculateTransformationMatrixForConfig(
          processedData.landmarkPoints6,
          processedData.cursorPositions,
          "6"
        );

        console.log("Successfully pre-calculated 3D matrices.");

      } catch (error) {
        console.error("Error pre-calculating 3D matrices:", error);

        // Fall back to conversion if direct calculation fails
        if (window.convert2DMatrixTo3D) {
          console.log("Trying 2D to 3D matrix conversion");
          state.transformationMatrices.threePoint3d = window.convert2DMatrixTo3D(
            state.transformationMatrices.threePoint2d, 3
          );
          state.transformationMatrices.sixPoint3d = window.convert2DMatrixTo3D(
            state.transformationMatrices.sixPoint2d, 6
          );
        }

        // Final fallback - copy 2D matrices if all else fails
        if (!state.transformationMatrices.threePoint3d) {
          console.warn("Using 2D matrices for 3D as fallback");
          state.transformationMatrices.threePoint3d = state.transformationMatrices.threePoint2d;
          state.transformationMatrices.sixPoint3d = state.transformationMatrices.sixPoint2d;
        }
      }
    } else {
      // For 3D native files
      state.transformationMatrices.threePoint3d = state.transformationMatrices.threePoint;
      state.transformationMatrices.sixPoint3d = state.transformationMatrices.sixPoint;

      // Now calculate 2D matrices
      console.log("Pre-calculating 2D matrices...");

      // Temporarily switch to 2D mode for calculation
      config.coordinateSystem = "2d";
      state.config.coordinateSystem = "2d";

      try {
        state.transformationMatrices.threePoint2d = calculateTransformationMatrixForConfig(
          processedData.landmarkPoints3,
          processedData.cursorPositions,
          "3"
        );

        state.transformationMatrices.sixPoint2d = calculateTransformationMatrixForConfig(
          processedData.landmarkPoints6,
          processedData.cursorPositions,
          "6"
        );

        console.log("Successfully pre-calculated 2D matrices");

      } catch (error) {
        console.error("Error pre-calculating 2D matrices:", error);

        // Fall back to 3D matrices if calculation fails
        console.warn("Using 3D matrices for 2D as fallback");
        state.transformationMatrices.threePoint2d = state.transformationMatrices.threePoint3d;
        state.transformationMatrices.sixPoint2d = state.transformationMatrices.sixPoint3d;
      }
    }

    // Restore original coordinate system
    config.coordinateSystem = nativeCoordinateSystem;
    state.config.coordinateSystem = nativeCoordinateSystem;

    // Verify all matrices exist
    console.log("=== TRANSFORMATION MATRICES STATUS ===");
    console.log("threePoint2d matrix available:", !!state.transformationMatrices.threePoint2d);
    console.log("sixPoint2d matrix available:", !!state.transformationMatrices.sixPoint2d);
    console.log("threePoint3d matrix available:", !!state.transformationMatrices.threePoint3d);
    console.log("sixPoint3d matrix available:", !!state.transformationMatrices.sixPoint3d);

    // Initialize filters
    // if (config.filterType === "oneEuro") {
    //   initializeFilters();
    // }

    // Reset cursor state
    state.lastHeadX = null;
    state.lastHeadY = null;
    state.cursorX = null;
    state.cursorY = null;

    // Calculate residuals directly
    const residuals = calculateResidualsDirectly();
    console.log("Calculated residuals directly:", residuals);

    // Store in state for access by other components
    state.calculatedResiduals = residuals;

    // Update application state
    state.isCalibrating = false;
    state.isTracking = true;

    console.log("Final tracking configuration:", {
      coordinateSystem: state.config.coordinateSystem,
      landmarkPoints: state.config.landmarkPoints,
      filterType: state.config.filterType
    });

    // After calculating transformation matrices:
    console.log("=== TRANSFORMATION MATRICES STATUS ===");
    console.log("threePoint2d matrix available:", !!state.transformationMatrices.threePoint2d);
    console.log("sixPoint2d matrix available:", !!state.transformationMatrices.sixPoint2d);
    console.log("threePoint3d matrix available:", !!state.transformationMatrices.threePoint3d);
    console.log("sixPoint3d matrix available:", !!state.transformationMatrices.sixPoint3d);

    // Check matrix dimensions
    if (state.transformationMatrices.threePoint2d) {
      try {
        const dims = math.size(math.matrix(state.transformationMatrices.threePoint2d));
        console.log("threePoint2d dimensions:", dims.toString());
      } catch (e) {
        console.error("Error checking threePoint2d dimensions:", e);
      }
    }

    if (state.transformationMatrices.sixPoint2d) {
      try {
        const dims = math.size(math.matrix(state.transformationMatrices.sixPoint2d));
        console.log("sixPoint2d dimensions:", dims.toString());
      } catch (e) {
        console.error("Error checking sixPoint2d dimensions:", e);
      }
    }

    return true;

  } catch (error) {
    console.error("Error processing calibration file:", error);
    // document.getElementById("status").textContent = "Error loading calibration file: " + error.message;
    return false;
  }
}

function processCalibrationData(data, config) {
  if (!data || !Array.isArray(data)) {
    console.error("Invalid data format:", data);
    throw new Error("Invalid calibration data format!");
  }

  console.log("Processing calibration data with config:", config);

  const processedData = {
    landmarkPoints3: [],
    landmarkPoints6: [],
    cursorPositions: [],
    allPoints: []
  };

  const is3D = config.coordinateSystem === "3d";

  data.forEach((row, index) => {
    try {
      if (!row.targetX || !row.targetY) {
        console.warn(`Missing target coordinates in row ${index}.`);
        return;
      }

      // Process 3-point landmarks
      const threePointVector = [];
      let validThreePoint = true;

      // Handle 3-point landmarks
      for (let i = 0; i < 3; i++) {
        const x = row[`landmark3_${i}_x`];
        const y = row[`landmark3_${i}_y`];
        // Always read z even if in 2D mode (makes it more robust when switching)
        const z = row[`landmark3_${i}_z`] || 0;

        if (typeof x === 'undefined' || typeof y === 'undefined') {
          console.warn(`Missing data for 3-point landmark ${i}.`);
          validThreePoint = false;
          break;
        }

        threePointVector.push([x], [y]);
        // Always include z in the vector (for compatibility with 3D mode)
        threePointVector.push([z]);

        // Add quadratic terms
        threePointVector.push([x * x * 0.00001], [y * y * 0.00001]);
        threePointVector.push([z * z * 0.0001]);
      }

      // Process 6-point landmarks
      const sixPointVector = [];
      let validSixPoint = true;

      // Handle 6-point landmarks
      for (let i = 0; i < 6; i++) {
        const x = row[`landmark6_${i}_x`];
        const y = row[`landmark6_${i}_y`];
        // Always read z even if in 2D mode
        const z = row[`landmark6_${i}_z`] || 0;

        if (typeof x === 'undefined' || typeof y === 'undefined') {
          console.warn(`Missing data for 6-point landmark ${i}.`);
          validSixPoint = false;
          break;
        }

        sixPointVector.push([x], [y]);
        // Always include z in the vector
        sixPointVector.push([z]);

        // Add quadratic terms
        sixPointVector.push([x * x * 0.00001], [y * y * 0.00001]);
        sixPointVector.push([z * z * 0.0001]);
      }

      // Only add valid data points
      if (validThreePoint && validSixPoint) {
        processedData.landmarkPoints3.push(threePointVector);
        processedData.landmarkPoints6.push(sixPointVector);
        processedData.cursorPositions.push([[row.targetX], [row.targetY]]);

        // Add a complete point record for residual calculation
        processedData.allPoints.push({
          targetX: row.targetX,
          targetY: row.targetY,
          landmarks3: threePointVector.map(v => v[0]),  // Flatten for easier access
          landmarks6: sixPointVector.map(v => v[0])     // Flatten for easier access
        });
      }
    } catch (error) {
      console.error(`Error processing row ${index}:`, error);
    }
  });

  // Validate processed data
  if (!processedData.landmarkPoints3.length ||
    !processedData.landmarkPoints6.length ||
    !processedData.cursorPositions.length) {
    throw new Error("No valid calibration points found in data!");
  }

  console.log("Processed calibration data:", {
    points3: processedData.landmarkPoints3.length,
    points6: processedData.landmarkPoints6.length,
    cursorPositions: processedData.cursorPositions.length,
    is3D: is3D,
    sampleAllPoint: processedData.allPoints[0] // Log sample for debugging
  });

  return processedData;
}

window.handleCalibrationUpload = handleCalibrationUpload;
