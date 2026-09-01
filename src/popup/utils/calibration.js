// src/popup/utils/calibration.js
// Processes live landmark samples collected during interactive calibration.
// Replaces the old CSV-based flow.

import { calculateTransformationMatrixForConfig, convert2DMatrixTo3D } from './math';

/**
 * Each sample is an array of MediaPipe landmark objects ({ x, y, z }).
 * cursorPoints is an array of { x, y } screen positions (pixels).
 * screenWidth / screenHeight are the dimensions of the calibration viewport.
 *
 * Returns the config object ready to be saved to chrome.storage.local,
 * or null on failure.
 */
export default function processCalibrationSamples(samples, cursorPoints, screenWidth, screenHeight) {
  try {
    console.log('Processing calibration samples…', {
      sampleCount: samples.length,
      cursorPointCount: cursorPoints.length,
    });

    if (!samples?.length || !cursorPoints?.length || samples.length !== cursorPoints.length) {
      throw new Error('Sample count and cursor point count must match and be non-zero.');
    }

    const config = {
      coordinateSystem: '2d',
      landmarkPoints: '3',
      filterType: 'exponential',
      calibrationWidth: screenWidth,
      calibrationHeight: screenHeight,
    };

    // ── Build feature vectors ──────────────────────────────────────────────
    // 3-point landmark indices (nose tip, left eye corner, right eye corner)
    const INDICES_3 = [1, 33, 263];
    // 6-point landmark indices (adds chin, left mouth corner, right mouth corner)
    const INDICES_6 = [1, 61, 291, 152, 33, 263];
    const QUADRATIC_SCALE = 0.00001;

    function buildVector2D(landmarks, indices) {
      const vec = [];
      for (const idx of indices) {
        const lm = landmarks[idx];
        if (!lm) return null;
        const x = lm.x * screenWidth;
        const y = lm.y * screenHeight;
        vec.push([x]);
        vec.push([y]);
        vec.push([x * x * QUADRATIC_SCALE]);
        vec.push([y * y * QUADRATIC_SCALE]);
      }
      return vec;
    }

    function buildVector3D(landmarks, indices) {
      const vec = [];
      for (const idx of indices) {
        const lm = landmarks[idx];
        if (!lm) return null;
        const x = lm.x * screenWidth;
        const y = lm.y * screenHeight;
        const z = (lm.z ?? 0) * screenWidth; // z is in the same scale as x
        vec.push([x]);
        vec.push([y]);
        vec.push([z]);
        vec.push([x * x * QUADRATIC_SCALE]);
        vec.push([y * y * QUADRATIC_SCALE]);
        vec.push([z * z * QUADRATIC_SCALE]);
      }
      return vec;
    }

    // Average the landmark arrays collected for each calibration point
    function averageLandmarks(landmarkArrays) {
      const count = landmarkArrays.length;
      if (count === 0) return null;
      const numLandmarks = landmarkArrays[0].length;
      const averaged = [];
      for (let i = 0; i < numLandmarks; i++) {
        let sx = 0, sy = 0, sz = 0;
        for (const arr of landmarkArrays) {
          sx += arr[i]?.x ?? 0;
          sy += arr[i]?.y ?? 0;
          sz += arr[i]?.z ?? 0;
        }
        averaged.push({ x: sx / count, y: sy / count, z: sz / count });
      }
      return averaged;
    }

    // Build averaged landmark arrays per calibration point
    const avgLandmarks = samples.map(sampleFrames => averageLandmarks(sampleFrames));

    // Build cursor position matrices [[x],[y]] per point
    const cursorPositions = cursorPoints.map(pt => [[pt.x], [pt.y]]);

    // ── 2D vectors ────────────────────────────────────────────────────────
    const lp3_2d = avgLandmarks.map(lm => buildVector2D(lm, INDICES_3));
    const lp6_2d = avgLandmarks.map(lm => buildVector2D(lm, INDICES_6));

    if (lp3_2d.some(v => v === null) || lp6_2d.some(v => v === null)) {
      throw new Error('One or more calibration points produced null landmark vectors.');
    }

    // ── 3D vectors ────────────────────────────────────────────────────────
    const lp3_3d = avgLandmarks.map(lm => buildVector3D(lm, INDICES_3));
    const lp6_3d = avgLandmarks.map(lm => buildVector3D(lm, INDICES_6));

    // ── Calculate transformation matrices ─────────────────────────────────
    const threePoint2d = calculateTransformationMatrixForConfig(lp3_2d, cursorPositions, '3', '2d');
    const sixPoint2d   = calculateTransformationMatrixForConfig(lp6_2d, cursorPositions, '6', '2d');
    const threePoint3d = calculateTransformationMatrixForConfig(lp3_3d, cursorPositions, '3', '3d')
                         ?? convert2DMatrixTo3D(threePoint2d, 3);
    const sixPoint3d   = calculateTransformationMatrixForConfig(lp6_3d, cursorPositions, '6', '3d')
                         ?? convert2DMatrixTo3D(sixPoint2d, 6);

    if (!threePoint2d || !sixPoint2d) {
      throw new Error('Failed to calculate transformation matrices.');
    }

    console.log('Calibration matrices calculated successfully.');

    return {
      ...config,
      threePoint2d,
      sixPoint2d,
      threePoint3d,
      sixPoint3d,
      // Raw data stored for potential re-processing
      landmarkPoints3: lp3_2d,
      landmarkPoints6: lp6_2d,
      cursorPositions,
    };
  } catch (err) {
    console.error('processCalibrationSamples failed:', err);
    return null;
  }
}
