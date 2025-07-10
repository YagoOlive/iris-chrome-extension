import { useState, useRef, useEffect } from 'react';
import './index.css';

// --- Setup View Component ---
function SetupView({ onSetupComplete }) {
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const [loadingCamera, setLoadingCamera] = useState(false);

  // 1. Handle CSV upload
  function handleChoose(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = evt => setFileData(evt.target.result);
    reader.readAsText(file);
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
        e.target.checked = false; // reset toggle
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
    if (!fileData) return alert('Upload a calibration file first.');
    if (!cameraEnabled) return alert('Enable camera first.');
    
    // Send data to background script to save and start tracking
    await chrome.runtime.sendMessage({
      cmd: 'START_TRACKING',
      calibrationCsv: fileData,
    });
    
    onSetupComplete(); // Tell the main App component to switch views
    window.close(); // Close the popup
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

      {/* Camera Toggle */}
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
    onStop(); // Tell the main App component to switch views
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

  // On component mount, ask the background script for the current state
  useEffect(() => {
    async function checkStatus() {
      const response = await chrome.runtime.sendMessage({ cmd: 'GET_STATUS' });
      // A valid CSV and active tracking means we show the status page
      if (response.isTrackingActive && response.calibrationCsv) {
        setView('status');
      } else {
        setView('setup');
      }
    }
    checkStatus();
  }, []);

  // Render based on the current view
  return (
    <div className="popup">
      {view === 'loading' && <p>Loading...</p>}
      {view === 'setup' && <SetupView onSetupComplete={() => setView('status')} />}
      {view === 'status' && <StatusView onStop={() => setView('setup')} />}
    </div>
  );
}

