// src/popup/App.jsx

import { useState, useRef, useEffect } from 'react';
import './index.css';

// --- Setup View Component ---
function SetupView({ savedData, onSetupComplete }) {
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [stream, setStream] = useState(null);
  const [loadingCamera, setLoadingCamera] = useState(false);

  const videoRef = useRef(null);

  // On initial render, check if there's saved data and pre-populate the state
  useEffect(() => {
    if (savedData) {
      // savedData is { name, content }
      setFileName(savedData.name);
      setFileData(savedData);
    }
  }, [savedData]);

  // 1. Handle CSV upload
  async function handleChoose(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1) Read the CSV as text
    const text = await file.text();

    // 2) Update React state with both name + content
    setFileName(file.name);
    setFileData({ name: file.name, content: text });

    // Prepare object for storage
    const toSet = {
      isTrackingActive: false,
      calibrationCsvContent: text,
      calibrationCsvName: file.name
    };

    // Store in chrome.storage.local
    chrome.storage.local.set(toSet, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
      } else {
        console.log('Calibration file saved to storage.');
      }
    });
  }

  // 2. Toggle camera on/off
  async function handleToggleCamera(e) {
    const wantOn = e.target.checked;
    if (wantOn) {
      setLoadingCamera(true);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        setCameraEnabled(true);
      } catch (err) {
        console.error('getUserMedia failed:', err);
        alert('Unable to access camera. Please check your browser settings.');
        e.target.checked = false;
      } finally {
        setLoadingCamera(false);
      }
    } else {
      // Toggle off: stop & release camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setCameraEnabled(false);
      setStream(null);
    }
  }

  // 3. Attach stream to video element
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // 4. Start head-tracking only if CSV + camera enabled
  async function handleStart() {
    if (!fileData) return alert('Upload or select a calibration file first.');
    if (!cameraEnabled) return alert('Enable camera first.');

    const message = {
      cmd: 'START_TRACKING',
      calibrationCsvName: fileData.name,
      calibrationCsvContent: fileData.content
    };

    await chrome.runtime.sendMessage(message);

    onSetupComplete();
    window.close();
  }

  return (
    <>
      <h2>Head-Tracking Setup</h2>
      <label className="file-picker">
        <input type="file" accept=".csv" onChange={handleChoose} hidden />
        <span>{fileName || 'Choose calibration CSV…'}</span>
      </label>
      <p>
        Don’t have a file?&nbsp;
        <a href="https://head-control-website.vercel.app" target="_blank" rel="noopener noreferrer">
          Run calibration site
        </a>
      </p>
      <div className="toggle-container">
        <label className="switch-label">
          <input type="checkbox" checked={cameraEnabled} onChange={handleToggleCamera} disabled={loadingCamera} />
          <span className="switch-slider"></span>
          <span className="switch-text">Enable Camera</span>
          {loadingCamera && <span className="spinner"></span>}
        </label>
      </div>
      {cameraEnabled && <video ref={videoRef} autoPlay playsInline muted className="video-preview" />}
      <button disabled={!fileData || !cameraEnabled} onClick={handleStart}>
        Start Head Tracking
      </button>
    </>
  );
}

// --- Status View Component ---
function StatusView({ onStop }) {
  async function handleStop() {
    await chrome.runtime.sendMessage({ cmd: 'STOP_TRACKING' });
    onStop();
    window.close();
  }

  return (
    <>
      <h2>Head-Tracking is Active</h2>
      <p>The custom cursor is now active on your web pages.</p>
      <button onClick={handleStop} className="stop-button">
        Stop Head Tracking
      </button>
    </>
  );
}

// --- Main App Component ---
export default function App() {
  const [view, setView] = useState('loading'); // 'loading', 'setup', 'status'

  // State to hold the saved calibration data from storage
  const [savedCalibrationData, setSavedCalibrationData] = useState(null);

  // This function will be called from both useEffect and the StatusView's onStop handler
  const checkStatus = async () => {
    chrome.storage.local.get(
      ['calibrationCsvContent', 'calibrationCsvName', 'isTrackingActive'],
      (items) => {
        if (items.calibrationCsvContent && items.calibrationCsvName) {
          setSavedCalibrationData({
            name: items.calibrationCsvName,
            content: items.calibrationCsvContent
          });
        }
        if (items.isTrackingActive) {
          setView('status');
        } else {
          // If tracking is not active, always show the setup view.
          // The setup view will then decide what to display based on whether it receives saved calibration data.
          setView('setup');
        }
      }
    );
  };

  // On component mount, ask the background script for the current state
  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="popup">
      {view === 'loading' && <p>Loading...</p>}
      {view === 'setup' && (
        <SetupView
          savedData={savedCalibrationData}
          onSetupComplete={() => setView('status')}
        />
      )}
      {view === 'status' && (
        // When stopping, we re-run checkStatus to switch to the correct setup view
        <StatusView onStop={checkStatus} />
      )}
    </div>
  );
}