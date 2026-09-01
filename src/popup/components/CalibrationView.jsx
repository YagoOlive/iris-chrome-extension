// src/popup/components/CalibrationView.jsx
//
// Interactive calibration flow: opens a fullscreen overlay, shows 9 points
// one at a time, collects MediaPipe landmarks for 3 s per point via the
// offscreen document (through the background port), then calculates the
// transformation matrices and saves them to chrome.storage.local.

import { useState, useEffect, useRef, useCallback } from 'react';
import processCalibrationSamples from '../utils/calibration';
import '../styles/CalibrationView.css';

// ── Calibration point layout (as fractions of viewport) ──────────────────
// 9 points: 4 corners + 4 edge midpoints + centre
const POINT_LAYOUT = [
  { id: 0, xFrac: 0.05, yFrac: 0.05 },  // top-left
  { id: 1, xFrac: 0.50, yFrac: 0.05 },  // top-centre
  { id: 2, xFrac: 0.95, yFrac: 0.05 },  // top-right
  { id: 3, xFrac: 0.05, yFrac: 0.50 },  // mid-left
  { id: 4, xFrac: 0.50, yFrac: 0.50 },  // centre
  { id: 5, xFrac: 0.95, yFrac: 0.50 },  // mid-right
  { id: 6, xFrac: 0.05, yFrac: 0.95 },  // bottom-left
  { id: 7, xFrac: 0.50, yFrac: 0.95 },  // bottom-centre
  { id: 8, xFrac: 0.95, yFrac: 0.95 },  // bottom-right
];

const COLLECT_DURATION_MS = 3000; // collection window per point
const COUNTDOWN_INTERVAL_MS = 50; // UI refresh rate for countdown

/**
 * Props:
 *   onComplete(config)  – called with the saved config after all points done
 *   onCancel()          – called when user cancels
 */
export default function CalibrationView({ onComplete, onCancel }) {
  // ── State ──────────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState('intro');     // 'intro' | 'collecting' | 'processing' | 'done' | 'error'
  const [pointIndex, setPointIndex]   = useState(0);
  const [countdown, setCountdown]     = useState(3);           // seconds remaining (display)
  const [errorMsg, setErrorMsg]       = useState('');

  // Collected samples: array (per calibration point) of arrays (landmark frames)
  const samplesRef  = useRef([]);
  const portRef     = useRef(null);
  const timerRef    = useRef(null);
  const frameBuffer = useRef([]);

  // ── Offscreen port connection ──────────────────────────────────────────
  useEffect(() => {
    // Connect to background to receive landmark stream
    const port = chrome.runtime.connect({ name: 'calibration-pose' });
    portRef.current = port;
    port.onDisconnect.addListener(() => { portRef.current = null; });
    return () => {
      port.disconnect();
      portRef.current = null;
    };
  }, []);

  // ── Landmark message listener ──────────────────────────────────────────
  useEffect(() => {
    const port = portRef.current;
    if (!port) return;
    const handler = ({ landmarks }) => {
      if (landmarks) frameBuffer.current.push(landmarks);
    };
    port.onMessage.addListener(handler);
    return () => port.onMessage.removeListener(handler);
  }, [portRef.current]); // re-attach if port reconnects

  // ── Collect one point ──────────────────────────────────────────────────
  const collectPoint = useCallback((idx) => {
    frameBuffer.current = [];
    setCountdown(3);

    const startTime = Date.now();

    const tick = () => {
      const elapsed  = Date.now() - startTime;
      const remaining = Math.max(0, COLLECT_DURATION_MS - elapsed);
      setCountdown(Math.ceil(remaining / 1000));

      if (elapsed >= COLLECT_DURATION_MS) {
        // Save the frames collected for this point
        samplesRef.current[idx] = [...frameBuffer.current];
        frameBuffer.current = [];

        const next = idx + 1;
        if (next < POINT_LAYOUT.length) {
          setPointIndex(next);
          collectPoint(next);
        } else {
          // All points done — process
          processAll();
        }
        return;
      }
      timerRef.current = setTimeout(tick, COUNTDOWN_INTERVAL_MS);
    };

    timerRef.current = setTimeout(tick, COUNTDOWN_INTERVAL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear pending timers on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // ── Process all collected samples ──────────────────────────────────────
  const processAll = useCallback(async () => {
    setPhase('processing');

    const w = window.screen.width;
    const h = window.screen.height;

    const cursorPoints = POINT_LAYOUT.map(p => ({
      x: p.xFrac * w,
      y: p.yFrac * h,
    }));

    const samples = samplesRef.current;

    // Validate that we actually have frames for every point
    const emptyIdx = samples.findIndex(frames => !frames || frames.length === 0);
    if (emptyIdx !== -1) {
      setErrorMsg(`No face detected at point ${emptyIdx + 1}. Make sure your face is visible and try again.`);
      setPhase('error');
      return;
    }

    const config = processCalibrationSamples(samples, cursorPoints, w, h);

    if (!config) {
      setErrorMsg('Could not calculate calibration matrices. Please try again.');
      setPhase('error');
      return;
    }

    // Save to storage
    await chrome.storage.local.set({
      isTrackingActive: false,
      config,
      calibrationDone: true,
    });

    setPhase('done');
    onComplete(config);
  }, [onComplete]);

  // ── Start calibration ──────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    samplesRef.current = [];
    setPointIndex(0);
    setPhase('collecting');
    collectPoint(0);
  }, [collectPoint]);

  // ── Retry ──────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    clearTimeout(timerRef.current);
    samplesRef.current = [];
    frameBuffer.current = [];
    setErrorMsg('');
    setPhase('intro');
    setPointIndex(0);
    setCountdown(3);
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────
  const currentPoint = POINT_LAYOUT[pointIndex];

  return (
    <div className="cal-overlay" role="dialog" aria-modal="true" aria-label="Calibration">

      {/* ── INTRO ── */}
      {phase === 'intro' && (
        <div className="cal-panel">
          <h2 className="cal-title">Calibration</h2>
          <p className="cal-desc">
            9 points will appear one at a time on the screen.<br />
            Look directly at each point for <strong>3 seconds</strong> while keeping your head still.<br />
            Keep your face centred in the camera throughout.
          </p>
          <div className="cal-actions">
            <button className="cal-btn cal-btn--primary" onClick={handleStart}>
              Start Calibration
            </button>
            <button className="cal-btn cal-btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── COLLECTING ── */}
      {phase === 'collecting' && (
        <>
          {/* Instruction banner */}
          <div className="cal-banner">
            <span className="cal-banner-text">
              Look at the dot — point {pointIndex + 1} of {POINT_LAYOUT.length}
            </span>
          </div>

          {/* Dots: render all, highlight active */}
          {POINT_LAYOUT.map((pt, i) => (
            <div
              key={pt.id}
              className={`cal-dot ${i === pointIndex ? 'cal-dot--active' : i < pointIndex ? 'cal-dot--done' : ''}`}
              style={{
                left: `${pt.xFrac * 100}%`,
                top:  `${pt.yFrac * 100}%`,
              }}
              aria-hidden="true"
            >
              {i === pointIndex && (
                <span className="cal-dot-countdown">{countdown}</span>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── PROCESSING ── */}
      {phase === 'processing' && (
        <div className="cal-panel">
          <div className="cal-spinner" aria-label="Processing calibration data" />
          <p className="cal-desc">Calculating calibration matrices…</p>
        </div>
      )}

      {/* ── DONE ── */}
      {phase === 'done' && (
        <div className="cal-panel">
          <div className="cal-success-icon" aria-hidden="true">✓</div>
          <h2 className="cal-title">Calibration Complete</h2>
          <p className="cal-desc">Your head-tracking profile has been saved.</p>
        </div>
      )}

      {/* ── ERROR ── */}
      {phase === 'error' && (
        <div className="cal-panel">
          <div className="cal-error-icon" aria-hidden="true">!</div>
          <h2 className="cal-title">Calibration Failed</h2>
          <p className="cal-desc cal-desc--error">{errorMsg}</p>
          <div className="cal-actions">
            <button className="cal-btn cal-btn--primary" onClick={handleRetry}>
              Try Again
            </button>
            <button className="cal-btn cal-btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
