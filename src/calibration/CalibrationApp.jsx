// src/calibration/CalibrationApp.jsx
//
// Standalone calibration page — runs in a dedicated Chrome tab (full screen).
// Connects to the background via port 'calibration-pose' to receive landmarks,
// collects samples for 9 points, computes matrices, saves to storage, then
// signals the popup and closes itself.

import { useState, useEffect, useRef, useCallback } from 'react';
import processCalibrationSamples from '../popup/utils/calibration';
import './calibration.css';

const POINT_LAYOUT = [
  { id: 0, xFrac: 0.05, yFrac: 0.05 },
  { id: 1, xFrac: 0.50, yFrac: 0.05 },
  { id: 2, xFrac: 0.95, yFrac: 0.05 },
  { id: 3, xFrac: 0.05, yFrac: 0.50 },
  { id: 4, xFrac: 0.50, yFrac: 0.50 },
  { id: 5, xFrac: 0.95, yFrac: 0.50 },
  { id: 6, xFrac: 0.05, yFrac: 0.95 },
  { id: 7, xFrac: 0.50, yFrac: 0.95 },
  { id: 8, xFrac: 0.95, yFrac: 0.95 },
];

const COLLECT_DURATION_MS = 3000;
const TICK_MS = 50;

export default function CalibrationApp() {
  const [phase, setPhase]           = useState('intro');
  const [pointIndex, setPointIndex] = useState(0);
  const [countdown, setCountdown]   = useState(3);
  const [errorMsg, setErrorMsg]     = useState('');

  const samplesRef  = useRef([]);
  const portRef     = useRef(null);
  const timerRef    = useRef(null);
  const frameBuffer = useRef([]);

  // ── Connect port to receive landmarks from offscreen via background ──
  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'calibration-pose' });
    portRef.current = port;

    const handler = ({ landmarks }) => {
      if (landmarks) frameBuffer.current.push(landmarks);
    };
    port.onMessage.addListener(handler);
    port.onDisconnect.addListener(() => { portRef.current = null; });

    return () => {
      port.onMessage.removeListener(handler);
      port.disconnect();
      portRef.current = null;
    };
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // ── Collect samples for one point ──
  const collectPoint = useCallback((idx) => {
    frameBuffer.current = [];
    setCountdown(3);
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      setCountdown(Math.ceil(Math.max(0, COLLECT_DURATION_MS - elapsed) / 1000));

      if (elapsed >= COLLECT_DURATION_MS) {
        samplesRef.current[idx] = [...frameBuffer.current];
        frameBuffer.current = [];
        const next = idx + 1;
        if (next < POINT_LAYOUT.length) {
          setPointIndex(next);
          collectPoint(next);
        } else {
          processAll();
        }
        return;
      }
      timerRef.current = setTimeout(tick, TICK_MS);
    };

    timerRef.current = setTimeout(tick, TICK_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Process and save ──
  const processAll = useCallback(async () => {
    setPhase('processing');

    const w = window.screen.width;
    const h = window.screen.height;

    const cursorPoints = POINT_LAYOUT.map(p => ({
      x: p.xFrac * w,
      y: p.yFrac * h,
    }));

    const samples = samplesRef.current;
    const emptyIdx = samples.findIndex(s => !s || s.length === 0);
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

    await chrome.storage.local.set({ config, calibrationDone: true, isTrackingActive: false });

    // Tell background to stop the calibration camera
    chrome.runtime.sendMessage({ cmd: 'STOP_CALIBRATION' });

    setPhase('done');

    // Close tab after a short delay so user sees the success message
    setTimeout(() => window.close(), 1500);
  }, []);

  const handleStart = useCallback(() => {
    samplesRef.current = [];
    setPointIndex(0);
    setPhase('collecting');
    collectPoint(0);
  }, [collectPoint]);

  const handleRetry = useCallback(() => {
    clearTimeout(timerRef.current);
    samplesRef.current = [];
    frameBuffer.current = [];
    setErrorMsg('');
    setPhase('intro');
    setPointIndex(0);
    setCountdown(3);
  }, []);

  const handleCancel = useCallback(() => {
    clearTimeout(timerRef.current);
    chrome.runtime.sendMessage({ cmd: 'STOP_CALIBRATION' });
    window.close();
  }, []);

  return (
    <div className="cal-root">

      {phase === 'intro' && (
        <div className="cal-panel">
          <h1 className="cal-title">Calibração</h1>
          <p className="cal-desc">
            9 pontos aparecerão na tela, um de cada vez.<br />
            Olhe diretamente para cada ponto por <strong>3 segundos</strong> mantendo a cabeça imóvel.<br />
            Mantenha o rosto centralizado na câmera durante todo o processo.
          </p>
          <div className="cal-actions">
            <button className="cal-btn cal-btn--primary" onClick={handleStart}>
              Iniciar Calibração
            </button>
            <button className="cal-btn cal-btn--ghost" onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {phase === 'collecting' && (
        <>
          <div className="cal-banner">
            <span>Olhe para o ponto — {pointIndex + 1} de {POINT_LAYOUT.length}</span>
          </div>

          {POINT_LAYOUT.map((pt, i) => (
            <div
              key={pt.id}
              className={`cal-dot${i === pointIndex ? ' cal-dot--active' : i < pointIndex ? ' cal-dot--done' : ''}`}
              style={{ left: `${pt.xFrac * 100}%`, top: `${pt.yFrac * 100}%` }}
              aria-hidden="true"
            >
              {i === pointIndex && <span className="cal-dot-countdown">{countdown}</span>}
            </div>
          ))}
        </>
      )}

      {phase === 'processing' && (
        <div className="cal-panel">
          <div className="cal-spinner" />
          <p className="cal-desc">Calculando matrizes de calibração…</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="cal-panel">
          <div className="cal-success-icon">✓</div>
          <h1 className="cal-title">Calibração Concluída</h1>
          <p className="cal-desc">Seu perfil foi salvo. Esta janela vai fechar automaticamente.</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="cal-panel">
          <div className="cal-error-icon">!</div>
          <h1 className="cal-title">Calibração Falhou</h1>
          <p className="cal-desc cal-desc--error">{errorMsg}</p>
          <div className="cal-actions">
            <button className="cal-btn cal-btn--primary" onClick={handleRetry}>Tentar Novamente</button>
            <button className="cal-btn cal-btn--ghost" onClick={handleCancel}>Cancelar</button>
          </div>
        </div>
      )}

    </div>
  );
}
