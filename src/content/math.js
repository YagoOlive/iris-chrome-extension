import * as math from 'mathjs';

function debugMatrixDimensions(matrix, name) {
  try {
    const matObj = math.matrix(matrix);
    const size = math.size(matObj).valueOf();
    console.log(`${name} dimensions:`, size);
    return true;
  } catch (error) {
    console.error(`Error creating matrix ${name}:`, error);
    console.log(`${name} data:`, matrix);
    return false;
  }
}

function getLandmarkIndices() {
  // Return appropriate landmark indices based on configuration
  if (state.config.landmarkPoints === "3") {
    // Basic set: nose tip, left eye, right eye
    return [1, 33, 263];
  } else {
    // Extended set using specific points for better tracking
    return [1, 61, 291, 152, 33, 263];
  }
}

function landmarksToVector(landmarks) {
  if (!landmarks) return null;

  try {
    const indices = getLandmarkIndices();
    let vector = [];
    const is3D = state.config.coordinateSystem === "3d";

    // Different scale factors for different dimensions
    const xyQuadraticScale = 0.00001;
    const zQuadraticScale = 0.00001;

    // Log configuration for debugging
    console.log("Creating landmark vector with config:", {
      coordinateSystem: state.config.coordinateSystem,
      numLandmarks: indices.length,
      is3D: is3D
    });

    for (const index of indices) {
      const landmark = landmarks[index];
      if (!landmark) {
        console.error(`Missing landmark at index ${index}`);
        return null;
      }

      // Validate required coordinates
      if (typeof landmark.x === "undefined" || typeof landmark.y === "undefined") {
        console.error(`Invalid landmark data at index ${index}:`, landmark);
        return null;
      }

      // Scale coordinates
      const x = landmark.x * window.innerWidth;
      const y = landmark.y * window.innerHeight;
      
      // Always get z-coordinate (default to 0 if missing)
      const z = (typeof landmark.z !== "undefined") ? landmark.z * 1000 : 0;

      // Always include z-coordinate for better compatibility between 2D and 3D modes
      vector.push([x]);
      vector.push([y]);
      vector.push([z]);  // Always include Z
      vector.push([x * x * xyQuadraticScale]);
      vector.push([y * y * xyQuadraticScale]);
      vector.push([z * z * zQuadraticScale]);  // Always include Z²
    }

    // Validate vector length
    const expectedLength = indices.length * 6;  // Always use 6 terms per landmark
    if (vector.length !== expectedLength) {
      console.error(`Invalid vector length: ${vector.length}, expected: ${expectedLength}`);
      return null;
    }

    console.log(`Created vector with length:`, vector.length);
    return vector;
  } catch (error) {
    console.error("Error in landmarksToVector:", error);
    return null;
  }
}

function transformCoordinates(landmarks) {
  if (!landmarks) return null;
  
  // Get the correct matrix based on current configuration
  const matrix = state.config.landmarkPoints === "3" ?
    state.transformationMatrices.threePoint :
    state.transformationMatrices.sixPoint;

  if (!matrix) {
    console.error("No transformation matrix found for current configuration");
    return null;
  }

  // Add this logging to verify the matrix being used
  console.log("transformCoordinates: Using", state.config.landmarkPoints, "point matrix");

  const landmarkVector = landmarksToVector(landmarks);
  if (!landmarkVector) return null;

  try {
    const P = math.matrix(landmarkVector);
    const B = math.matrix(matrix); // Use selected matrix
    const Q = math.multiply(B, P);
    return Q.toArray();
  } catch (error) {
    console.error("Transformation error:", {
      error: error.message,
      matrixSize: math.size(matrix),
      vectorSize: landmarkVector.length
    });
    return null;
  }
}

// Function to create a compatible 3D transformation matrix from 2D data
export function convert2DMatrixTo3D(matrix2D, landmarkCount) {
  try {
    console.log("Converting 2D matrix to 3D format");
    
    // Verify the input matrix dimensions
    const matrixSize = math.size(math.matrix(matrix2D));
    const expectedWidth = landmarkCount === 3 ? 12 : 24;
    
    if (matrixSize[1] !== expectedWidth) {
      console.error(`Invalid 2D matrix dimensions for conversion: expected width ${expectedWidth}, got ${matrixSize[1]}`);
      return null;
    }
    
    // Extract the core transformation coefficients from 2D matrix
    // In a 2D matrix, we have rows that transform x,y coordinates
    const xCoefficients = matrix2D[0]; // First row controls x output
    const yCoefficients = matrix2D[1]; // Second row controls y output
    
    // Create a new 3D matrix (adding z = 0 mapping)
    // For each landmark in 2D we have 4 coefficients: x, y, x², y²
    // For each landmark in 3D we need 6 coefficients: x, y, z, x², y², z²
    
    // For 3-point setup: need matrix with 2×18 dimensions
    // For 6-point setup: need matrix with 2×36 dimensions
    
    // Create empty arrays with correct capacity
    const xRow = new Array(landmarkCount * 6).fill(0);
    const yRow = new Array(landmarkCount * 6).fill(0);
    
    // For each landmark, map the 2D coefficients to 3D positions
    for (let i = 0; i < landmarkCount; i++) {
      const baseIdx2D = i * 4; // Each landmark has 4 coefficients in 2D
      const baseIdx3D = i * 6; // Each landmark will have 6 coefficients in 3D
      
      // Copy x, y coefficients
      xRow[baseIdx3D] = xCoefficients[baseIdx2D];     // x coefficient for x output
      xRow[baseIdx3D + 1] = xCoefficients[baseIdx2D + 1]; // y coefficient for x output
      xRow[baseIdx3D + 2] = 0;                        // z coefficient for x output (zero)
      
      yRow[baseIdx3D] = yCoefficients[baseIdx2D];     // x coefficient for y output
      yRow[baseIdx3D + 1] = yCoefficients[baseIdx2D + 1]; // y coefficient for y output
      yRow[baseIdx3D + 2] = 0;                        // z coefficient for y output (zero)
      
      // Copy quadratic terms
      xRow[baseIdx3D + 3] = xCoefficients[baseIdx2D + 2]; // x² coefficient for x output
      xRow[baseIdx3D + 4] = xCoefficients[baseIdx2D + 3]; // y² coefficient for x output
      xRow[baseIdx3D + 5] = 0;                        // z² coefficient for x output (zero)
      
      yRow[baseIdx3D + 3] = yCoefficients[baseIdx2D + 2]; // x² coefficient for y output
      yRow[baseIdx3D + 4] = yCoefficients[baseIdx2D + 3]; // y² coefficient for y output
      yRow[baseIdx3D + 5] = 0;                        // z² coefficient for y output (zero)
    }
    
    // Build the matrix
    const matrix3D = [xRow, yRow];
    
    // Verify the output matrix dimensions
    const outputSize = math.size(math.matrix(matrix3D));
    const expectedColumns = landmarkCount * 6;
    if (outputSize[0] !== 2 || outputSize[1] !== expectedColumns) {
      console.error(`Invalid output matrix dimensions: got ${outputSize}, expected [2,${expectedColumns}]`);
      return null;
    }
    
    console.log(`Successfully converted 2D matrix to 3D format with dimensions [2,${expectedColumns}]`);
    return matrix3D;
  } catch (error) {
    console.error("Error converting 2D matrix to 3D:", error);
    return null;
  }
}

export function calculateTransformationMatrixForConfig(landmarkPoints, cursorPositions, configType) {
  try {
      // Detailed debug logging
      console.log(`Starting ${configType}-point matrix calculation:`, {
          landmarkPointsLength: landmarkPoints?.length,
          cursorPositionsLength: cursorPositions?.length,
          samplePoint: landmarkPoints?.[0]
      });

      // Basic validation
      if (!landmarkPoints || !cursorPositions || landmarkPoints.length === 0) {
          throw new Error("Missing or empty input data");
      }

      const totalPoints = landmarkPoints.length;
      const is3D = state.config.coordinateSystem === "3d";
      
      // Adjust terms per landmark based on coordinate system
      const termsPerLandmark = is3D ? 3 : 2;  // Basic terms (x,y) or (x,y,z)
      const quadraticTerms = is3D ? 3 : 2;    // Quadratic terms (x²,y²) or (x²,y²,z²)
      const totalTermsPerLandmark = termsPerLandmark + quadraticTerms;
      const numLandmarks = parseInt(configType);
      const totalRows = totalTermsPerLandmark * numLandmarks;

      console.log("Configuration:", {
          is3D,
          termsPerLandmark,
          quadraticTerms,
          totalTermsPerLandmark,
          numLandmarks,
          totalRows
      });

      // Validate first point structure
      const firstPoint = landmarkPoints[0];
      if (!firstPoint || firstPoint.length !== totalRows) {
          console.error("Data structure mismatch:", {
              expected: totalRows,
              got: firstPoint?.length,
              firstPoint
          });
          throw new Error(`Invalid data structure: expected ${totalRows} rows, got ${firstPoint?.length}`);
      }

      // Initialize P matrix
      let P = Array.from({ length: totalRows }, () => new Array(totalPoints).fill(0));

      // Fill P matrix
      for (let j = 0; j < totalPoints; j++) {
          const point = landmarkPoints[j];
          if (!point || point.length !== totalRows) {
              throw new Error(`Invalid data at point ${j}`);
          }
          for (let i = 0; i < totalRows; i++) {
              P[i][j] = point[i][0];
          }
      }

      // Initialize Q matrix (target positions)
      let Q = Array.from({ length: 2 }, () => new Array(totalPoints).fill(0));
      for (let j = 0; j < totalPoints; j++) {
          const pos = cursorPositions[j];
          if (!pos || pos.length !== 2) {
              throw new Error(`Invalid cursor position at point ${j}`);
          }
          Q[0][j] = pos[0][0];
          Q[1][j] = pos[1][0];
      }

      // Matrix operations with regularization
      const matP = math.matrix(P);
      const matQ = math.matrix(Q);
      const PT = math.transpose(matP);
      const PPT = math.multiply(matP, PT);

      // Adjust regularization based on coordinate system and points
      const lambda = is3D ? 0.02 : 0.01;
      const I = math.identity(totalRows);
      const regularizedPPT = math.add(PPT, math.multiply(lambda, I));

      const PPTInv = math.inv(regularizedPPT);
      const QPT = math.multiply(matQ, PT);
      const B = math.multiply(QPT, PPTInv);

      console.log(`Successfully calculated ${configType}-point matrix`);
      return B.toArray();

  } catch (error) {
      console.error(`Error calculating ${configType}-point matrix:`, error);
      console.error("Stack:", error.stack);
      return null;
  }
}

window.convert2DMatrixTo3D = convert2DMatrixTo3D;
window.calculateTransformationMatrixForConfig = calculateTransformationMatrixForConfig;