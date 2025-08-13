import Papa from 'papaparse';
import * as math from 'mathjs';

import { calculateTransformationMatrixForConfig, convert2DMatrixTo3D } from './math';

// Handle user-uploaded calibration (.csv) file
export default async function handleCalibrationUpload(text) {
  try {
    console.log("Starting calibration file upload...");

    const config = {
      coordinateSystem: "2d",
      landmarkPoints: "3",
      filterType: "exponential",
    };

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

    // Determine configuration
    const headers = Object.keys(result.data[0]);

    // Improved 3D coordinate detection
    const has3DCoordinates = headers.some(header =>
      header.includes("_z") ||
      header.includes("landmark3_2_z") ||
      header.includes("landmark6_2_z")
    );

    if (has3DCoordinates) {
      config.coordinateSystem = "3d";
      console.log("Detected 3D coordinates in calibration data.");
    }

    // Process the calibration data
    const processedData = processCalibrationData(result.data, config);

    const calibrationData = processedData;

    // Restore calibration dimensions from metadata if available
    if (metadata.calibrationWidth && metadata.calibrationHeight) {
      calibrationData.calibrationWidth = metadata.calibrationWidth;
      calibrationData.calibrationHeight = metadata.calibrationHeight;
      console.log("Restored calibration dimensions:", {
        width: metadata.calibrationWidth,
        height: metadata.calibrationHeight
      });
    } else {
      console.warn("No calibration dimensions found. Fallback to current window dimensions...");
      console.warn(`Viewport Width: ${window.innerWidth}, Viewport Height: ${window.innerHeight}`);
      calibrationData.calibrationWidth = window.innerWidth;
      calibrationData.calibrationHeight = window.innerHeight;
    }

    // Always calculate all matrices for both coordinate systems and point configurations
    console.log("Pre-calculating all transformation matrices...");

    // First calculate matrices for the file's native coordinate system
    const nativeCoordinateSystem = config.coordinateSystem;
    console.log(`Calculating matrices for native coordinate system: ${nativeCoordinateSystem}`);

    // Calculate matrices in the native mode
    const transformationMatrices = {
      threePoint: calculateTransformationMatrixForConfig(
        processedData.landmarkPoints3,
        processedData.cursorPositions,
        "3",
        config.coordinateSystem
      ),
      sixPoint: calculateTransformationMatrixForConfig(
        processedData.landmarkPoints6,
        processedData.cursorPositions,
        "6",
        config.coordinateSystem
      )
    };

    // Store in coordinate-system-specific locations
    if (nativeCoordinateSystem === "2d") {
      transformationMatrices.threePoint2d = transformationMatrices.threePoint;
      transformationMatrices.sixPoint2d = transformationMatrices.sixPoint;

      // Now calculate 3D matrices
      console.log("Pre-calculating 3D matrices...");

      // Temporarily switch to 3D mode for calculation
      config.coordinateSystem = "3d";

      try {
        transformationMatrices.threePoint3d = calculateTransformationMatrixForConfig(
          processedData.landmarkPoints3,
          processedData.cursorPositions,
          "3",
          config.coordinateSystem
        );

        transformationMatrices.sixPoint3d = calculateTransformationMatrixForConfig(
          processedData.landmarkPoints6,
          processedData.cursorPositions,
          "6",
          config.coordinateSystem
        );

        console.log("Successfully pre-calculated 3D matrices.");

      } catch (error) {
        console.error("Error pre-calculating 3D matrices:", error);

        // Fall back to conversion if direct calculation fails
        console.log("Trying 2D to 3D matrix conversion");
        transformationMatrices.threePoint3d = convert2DMatrixTo3D(
          transformationMatrices.threePoint2d, 3
        );
        transformationMatrices.sixPoint3d = convert2DMatrixTo3D(
          transformationMatrices.sixPoint2d, 6
        );

        // Final fallback - copy 2D matrices if all else fails
        if (!transformationMatrices.threePoint3d) {
          console.warn("Using 2D matrices for 3D as fallback");
          transformationMatrices.threePoint3d = transformationMatrices.threePoint2d;
          transformationMatrices.sixPoint3d = transformationMatrices.sixPoint2d;
        }
      }
    } else {
      // For 3D native files
      transformationMatrices.threePoint3d = transformationMatrices.threePoint;
      transformationMatrices.sixPoint3d = transformationMatrices.sixPoint;

      // Now calculate 2D matrices
      console.log("Pre-calculating 2D matrices...");

      // Temporarily switch to 2D mode for calculation
      config.coordinateSystem = "2d";

      if (!transformationMatrices.threePoint2d || !transformationMatrices.sixPoint2d) {
        console.warn("Missing required 2D matrices. Attempting to use available matrices as fallback.");

        // Use the generic matrices as fallback
        if (transformationMatrices.threePoint && !transformationMatrices.threePoint2d) {
          // Check dimensions to ensure it's actually a 2D matrix
          try {
            const matrixDim = math.size(math.matrix(transformationMatrices.threePoint));
            const isTwoDimensional = (matrixDim[1] === 12); // 2D three-point matrix should have 12 columns

            if (isTwoDimensional) {
              transformationMatrices.threePoint2d = transformationMatrices.threePoint;
              console.log("Using generic three-point matrix for 2D (confirmed 2D dimensions)");
            } else {
              console.log("Generic three-point matrix has incompatible dimensions for 2D mode");
            }
          } catch (dimError) {
            console.error("Error checking matrix dimensions:", dimError);
          }
        }

        if (transformationMatrices.sixPoint && !transformationMatrices.sixPoint2d) {
          // Check dimensions to ensure it's actually a 2D matrix
          try {
            const matrixDim = math.size(math.matrix(transformationMatrices.sixPoint));
            const isTwoDimensional = (matrixDim[1] === 24); // 2D six-point matrix should have 24 columns

            if (isTwoDimensional) {
              transformationMatrices.sixPoint2d = transformationMatrices.sixPoint;
              console.log("Using generic six-point matrix for 2D (confirmed 2D dimensions)");
            } else {
              console.log("Generic six-point matrix has incompatible dimensions for 2D mode!");
            }
          } catch (dimError) {
            console.error("Error checking matrix dimensions:", dimError);
          }
        }

        // DO NOT use 3D matrices as fallbacks for 2D since dimensions won't match
        // Instead, try to recalculate proper 2D matrices if we have calibration data
        if ((!transformationMatrices.threePoint2d || !transformationMatrices.sixPoint2d) &&
          calibrationData && calibrationData.landmarkPoints3 &&
          calibrationData.cursorPositions && typeof calculateTransformationMatrixForConfig === 'function') {

          console.log("Attempting to calculate proper 2D matrices from calibration data...");

          // Temporarily set to 2D for matrix calculation
          const oldCoordSystem = config.coordinateSystem;
          config.coordinateSystem = "2d";

          try {
            // Convert 3D landmark data to 2D format
            const landmarks3_2D = convert3DLandmarksTo2D(calibrationData.landmarkPoints3);
            const landmarks6_2D = convert3DLandmarksTo2D(calibrationData.landmarkPoints6);

            if (landmarks3_2D && !transformationMatrices.threePoint2d) {
              transformationMatrices.threePoint2d = calculateTransformationMatrixForConfig(
                landmarks3_2D, // Use converted 2D data
                calibrationData.cursorPositions,
                "3",
                config.coordinateSystem
              );
              console.log("Successfully calculated 2D three-point matrix");
            }

            if (landmarks6_2D && !transformationMatrices.sixPoint2d) {
              transformationMatrices.sixPoint2d = calculateTransformationMatrixForConfig(
                landmarks6_2D, // Use converted 2D data
                calibrationData.cursorPositions,
                "6",
                config.coordinateSystem
              );
              console.log("Successfully calculated 2D six-point matrix");
            }
          } catch (err) {
            console.error("Error calculating 2D matrices:", err);
          } finally {
            // Restore original coordinate system
            config.coordinateSystem = oldCoordSystem;
          }
        }

        // Check again after all fallback attempts
        if (!transformationMatrices.threePoint2d || !transformationMatrices.sixPoint2d) {
          console.error("Still missing required 2D matrices with correct dimensions. Cannot switch to 2D mode.");
          // setError("Missing proper 2D transformation matrices. Please reload calibration file.");
          return;
        }
      }
    }

    // Verify all matrices exist
    console.log("=== TRANSFORMATION MATRICES STATUS ===");
    console.log("threePoint2d matrix available:", !!transformationMatrices.threePoint2d);
    console.log("sixPoint2d matrix available:", !!transformationMatrices.sixPoint2d);
    console.log("threePoint3d matrix available:", !!transformationMatrices.threePoint3d);
    console.log("sixPoint3d matrix available:", !!transformationMatrices.sixPoint3d);

    // Initialize filters
    // if (config.filterType === "oneEuro") {
    //   initializeFilters();
    // }

    console.log("Final tracking configuration:", {
      coordinateSystem: config.coordinateSystem,
      landmarkPoints: config.landmarkPoints,
      filterType: config.filterType
    });

    // After calculating transformation matrices:
    console.log("=== TRANSFORMATION MATRICES STATUS ===");
    console.log("threePoint2d matrix available:", !!transformationMatrices.threePoint2d);
    console.log("sixPoint2d matrix available:", !!transformationMatrices.sixPoint2d);
    console.log("threePoint3d matrix available:", !!transformationMatrices.threePoint3d);
    console.log("sixPoint3d matrix available:", !!transformationMatrices.sixPoint3d);

    // Check matrix dimensions
    if (transformationMatrices.threePoint2d) {
      try {
        const dims = math.size(math.matrix(transformationMatrices.threePoint2d));
        console.log("threePoint2d dimensions:", dims.toString());
      } catch (e) {
        console.error("Error checking threePoint2d dimensions:", e);
      }
    }

    if (transformationMatrices.sixPoint2d) {
      try {
        const dims = math.size(math.matrix(transformationMatrices.sixPoint2d));
        console.log("sixPoint2d dimensions:", dims.toString());
      } catch (e) {
        console.error("Error checking sixPoint2d dimensions:", e);
      }
    }

    return {
      coordinateSystem: config.coordinateSystem,
      landmarkPoints: config.landmarkPoints,
      filterType: config.filterType,
      calibrationWidth: calibrationData.calibrationWidth,
      calibrationHeight: calibrationData.calibrationHeight,
      ...transformationMatrices,
      threePoint: null,
      sixPoint: null,
    };

  } catch (error) {
    console.error("Error processing calibration file:", error);
    return null;
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
    allPoints: [],
    calibrationWidth: null,
    calibrationHeight: null,
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

// Convert 3D landmarks to 2D format
function convert3DLandmarksTo2D(landmarks3D) {
  if (!landmarks3D || !landmarks3D.length) return null;

  try {
    // Create a new array for 2D formatted landmarks
    const landmarks2D = [];

    // For each calibration point
    for (let i = 0; i < landmarks3D.length; i++) {
      const point3D = landmarks3D[i];
      const point2D = [];

      // For each landmark in a 3D point (which has 6 values per landmark: x,y,z,x²,y²,z²)
      // we convert to 2D format (which has 4 values per landmark: x,y,x²,y²)
      const totalLandmarks = point3D.length / 6; // Calculate number of landmarks

      // Process each landmark
      for (let j = 0; j < totalLandmarks; j++) {
        const baseIdx3D = j * 6; // Each landmark has 6 values in 3D

        // Extract just x and y values (skip z)
        point2D.push([point3D[baseIdx3D][0]]);     // x
        point2D.push([point3D[baseIdx3D + 1][0]]); // y

        // Extract just x² and y² values (skip z²)
        point2D.push([point3D[baseIdx3D + 3][0]]); // x²
        point2D.push([point3D[baseIdx3D + 4][0]]); // y²
      }

      landmarks2D.push(point2D);
    }

    return landmarks2D;
  } catch (error) {
    console.error("Error converting 3D landmarks to 2D format:", error);
    return null;
  }
}
