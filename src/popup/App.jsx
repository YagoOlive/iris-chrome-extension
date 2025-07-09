import { useState, useRef, useEffect } from 'react';
import './index.css';

export default function App() {
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
        // Check camera‐permission state
        let status;
        status = await navigator.permissions.query({ name: 'camera' });
        console.log(`STATUS IS ${status.state}`)
        // If prompt or granted, fire getUserMedia
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        setCameraEnabled(true);
      } catch (err) {
        console.error('getUserMedia failed:', err);
        alert('Unable to access camera. Please check your browser settings.');
        e.target.checked = false;   // reset toggle
      } finally {
        setLoadingCamera(false);
      }

    } else {
      // 4️⃣ Toggle off: stop & release camera
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
      videoRef.current.srcObject = stream;    // Bind MediaStream to <video>
    }
  }, [stream]);                               // Re-run when stream changes

  // 4. Start head-tracking only if CSV + camera enabled
  async function handleStart() {
    if (!fileData) return alert('Upload a calibration file first.');
    if (!cameraEnabled) return alert('Enable camera first.');
    await chrome.storage.local.set({ calibrationCsv: fileData });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ cmd: 'INJECT_TRACKER', tabId: tab.id });
    window.close();
  }

  return (
    <div className="popup">
      <h2>Head-Tracking Cursor</h2>

      {/* CSV Upload */}
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
          <input
            type="checkbox"
            checked={cameraEnabled}
            onChange={handleToggleCamera}
            disabled={loadingCamera}
          />
          <span className="switch-slider"></span>
          <span className="switch-text">Enable Camera</span>
          {loadingCamera && <span className="spinner"></span>}
        </label>
      </div>

      {/* Live Preview */}
      {cameraEnabled && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-preview"
        />
      )}

      {/* Start Button */}
      <button
        disabled={!fileData || !cameraEnabled}
        onClick={handleStart}
      >
        Start head tracking
      </button>
    </div>
  );
}

