// Own implementation of residual calculation
function calculateResidualsDirectly() {
  try {
    console.log("Calculating residuals directly from calibration data...");
    
    if (!state.calibrationData || 
        !state.calibrationData.landmarkPoints3 || 
        !state.calibrationData.landmarkPoints6 || 
        !state.calibrationData.cursorPositions ||
        !state.transformationMatrices) {
      console.warn("Missing calibration data or matrices for direct residual calculation");
      return null;
    }
    
    // Determine which landmark points to use based on current configuration
    const landmarks = state.config.landmarkPoints === "3" ? 
      state.calibrationData.landmarkPoints3 : 
      state.calibrationData.landmarkPoints6;
      
    // Get the appropriate transformation matrix
    const matrix = state.config.landmarkPoints === "3" ? 
      state.transformationMatrices.threePoint : 
      state.transformationMatrices.sixPoint;
      
    if (!landmarks.length || !matrix) {
      console.warn("Missing landmarks or transformation matrix");
      return null;
    }
    
    // Calculate predicted positions using the transformation matrix
    const predictedPositions = landmarks.map(landmark => {
      try {
        const result = math.multiply(matrix, landmark);
        return { x: result[0][0], y: result[1][0] };
      } catch (err) {
        console.error("Error predicting position:", err);
        return null;
      }
    }).filter(pos => pos !== null);
    
    // Get actual positions
    const actualPositions = state.calibrationData.cursorPositions.map(pos => {
      return { x: pos[0][0], y: pos[1][0] };
    });
    
    // Make sure we have matching pairs
    const numPoints = Math.min(predictedPositions.length, actualPositions.length);
    
    if (numPoints === 0) {
      console.warn("No valid position pairs for residual calculation");
      return null;
    }
    
    // Calculate residuals (distances between predicted and actual)
    const residuals = [];
    let sumSquaredError = 0;
    let sumError = 0;
    let maxError = 0;
    
    for (let i = 0; i < numPoints; i++) {
      const predicted = predictedPositions[i];
      const actual = actualPositions[i];
      
      const dx = predicted.x - actual.x;
      const dy = predicted.y - actual.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      residuals.push(distance);
      sumSquaredError += distance * distance;
      sumError += distance;
      maxError = Math.max(maxError, distance);
    }
    
    // Calculate metrics
    const rmse = Math.sqrt(sumSquaredError / numPoints);
    const meanError = sumError / numPoints;
    
    console.log("Direct residual calculation results:", {
      numPoints,
      rmse: rmse.toFixed(2),
      meanError: meanError.toFixed(2),
      maxError: maxError.toFixed(2)
    });
    
    return {
      rmse: rmse,
      meanError: meanError,
      maxError: maxError
    };
  } catch (error) {
    console.error("Error in direct residual calculation:", error);
    return null;
  }
}

function calculateCalibrationResiduals() {
  try {
    if (!state.calibrationData || !state.transformationMatrices) {
      console.warn("Cannot calculate residuals: missing calibration data or transformation matrices");
      return null;
    }

    const { landmarkPoints3, landmarkPoints6, cursorPositions } = state.calibrationData;
    const currentPoints = state.config.landmarkPoints === "3" ? landmarkPoints3 : landmarkPoints6;
    const currentMatrix = state.config.landmarkPoints === "3" 
      ? state.transformationMatrices.threePoint 
      : state.transformationMatrices.sixPoint;
    
    if (!currentPoints || !currentPoints.length || !currentMatrix) {
      console.warn("Cannot calculate residuals: missing points or transformation matrix");
      return null;
    }

    // Calculate predicted cursor positions using our transformation matrix
    const predictedPositions = currentPoints.map(point => {
      const result = math.multiply(currentMatrix, point);
      return [result[0][0], result[1][0]]; // Extract x, y as simple array
    });

    // Get actual cursor positions
    const actualPositions = cursorPositions.map(pos => [pos[0][0], pos[1][0]]);

    // Calculate residuals (Euclidean distance between predicted and actual)
    const residuals = predictedPositions.map((pred, i) => {
      const actual = actualPositions[i];
      const dx = pred[0] - actual[0];
      const dy = pred[1] - actual[1];
      return Math.sqrt(dx * dx + dy * dy);
    });

    // Calculate statistics
    const meanResidual = residuals.reduce((sum, val) => sum + val, 0) / residuals.length;
    const maxResidual = Math.max(...residuals);
    
    console.log("Calculated residuals:", {
      mean: meanResidual.toFixed(2),
      max: maxResidual.toFixed(2),
      individual: residuals.map(r => r.toFixed(2))
    });

    return {
      mean: meanResidual,
      max: maxResidual,
      individual: residuals
    };
  } catch (error) {
    console.error("Error calculating residuals:", error);
    return null;
  }
}

// Calculate residuals for end points only
function calculateEndPointResiduals() {
  try {
    // Get current configuration
    const currentConfig = state.config.landmarkPoints;
    const is3D = state.config.coordinateSystem === "3d";
    
    // Select appropriate data and matrix based on configuration
    const points = currentConfig === "3" ? 
      state.calibrationData.landmarkPoints3 : 
      state.calibrationData.landmarkPoints6;
        
    const matrix = is3D ? 
      (currentConfig === "3" ? 
        state.transformationMatrices.threePoint3d : 
        state.transformationMatrices.sixPoint3d) :
      (currentConfig === "3" ? 
        state.transformationMatrices.threePoint2d : 
        state.transformationMatrices.sixPoint2d);

    if (!points || !state.calibrationData.cursorPositions || !matrix) {
      console.error("Missing required data for end point residual calculation");
      return null;
    }

    // Determine end point indices
    let endPointIndices = [];
    
    if (state.calibrationData.endPointIndices && state.calibrationData.endPointIndices.length > 0) {
      // Use existing indices if available
      endPointIndices = state.calibrationData.endPointIndices;
      console.log("Using explicitly marked end points:", endPointIndices.length);
    } else {
      // For older data without explicit end point marking:
      // Group points by their target positions (rounded to nearest integer to handle slight variations)
      const targetPositionMap = new Map();
      
      state.calibrationData.cursorPositions.forEach((pos, index) => {
        // Create a key from rounded target position
        const key = `${Math.round(pos[0][0])},${Math.round(pos[1][0])}`;
        
        // Store the latest index for each position
        targetPositionMap.set(key, index);
      });
      
      // Use the last point for each unique target position
      endPointIndices = Array.from(targetPositionMap.values());
      console.log("Using last point for each grid position:", endPointIndices.length);
    }

    const residuals = [];
    let totalSquaredError = 0;
    let totalError = 0;

    // Only process end points
    for (const i of endPointIndices) {
      if (i >= points.length) continue; // Skip if index is out of bounds
      
      let landmarks = points[i];
      
      // If 2D, convert the 3D data to 2D format
      if (!is3D) {
        const numLandmarks = currentConfig === "3" ? 3 : 6;
        landmarks = [];
        
        for (let j = 0; j < numLandmarks; j++) {
          const baseIndex = j * 6;
          landmarks.push([points[i][baseIndex][0]]);     // x
          landmarks.push([points[i][baseIndex + 1][0]]); // y
          landmarks.push([points[i][baseIndex + 3][0]]); // x²
          landmarks.push([points[i][baseIndex + 4][0]]); // y²
        }
      }

      const targetPos = state.calibrationData.cursorPositions[i];

      const P = math.matrix(landmarks);
      const B = math.matrix(matrix);
      const predictedPos = math.multiply(B, P).toArray();

      const dx = predictedPos[0][0] - targetPos[0][0];
      const dy = predictedPos[1][0] - targetPos[1][0];
      const error = Math.sqrt(dx * dx + dy * dy);

      totalSquaredError += error * error;
      totalError += error;

      residuals.push({
        pointNumber: i + 1,
        targetX: targetPos[0][0],
        targetY: targetPos[1][0],
        predictedX: predictedPos[0][0],
        predictedY: predictedPos[1][0],
        error: error,
      });
    }

    if (residuals.length === 0) {
      console.warn("No end point residuals calculated - no end points found");
      return null;
    }

    const rmse = Math.sqrt(totalSquaredError / residuals.length);
    const meanError = totalError / residuals.length;
    const maxError = Math.max(...residuals.map((r) => r.error));

    console.log("=== End Point Residuals Analysis ===");
    console.log(`Configuration: ${is3D ? '3D' : '2D'} ${currentConfig}-point`);
    console.log(`RMSE: ${rmse.toFixed(2)} pixels`);
    console.log(`Mean Error: ${meanError.toFixed(2)} pixels`);
    console.log(`Total Error: ${totalError.toFixed(2)} pixels`);
    console.log(`Max Error: ${maxError.toFixed(2)} pixels`);
    console.log(`End Points Analyzed: ${residuals.length}`);
    console.log("\nDetailed residuals for end points:", residuals);

    return {
      residuals,
      rmse,
      meanError,
      totalError,
      maxError,
      count: residuals.length
    };
  } catch (error) {
    console.error("Error calculating end point residuals:", error);
    return null;
  }
}