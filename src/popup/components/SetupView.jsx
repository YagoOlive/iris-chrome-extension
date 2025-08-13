import { useState, useRef, useEffect } from 'react';
import '../styles/SetupView.css';

import handleCalibrationUpload from '../utils/calibration';

// --- Setup View Component ---
export default function SetupView({ savedData, onSetupComplete }) {
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState(null);
  const [fileConfig, setFileConfig] = useState(null);
  const [fileError, setFileError] = useState('');

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [stream, setStream] = useState(null);

  const [loadingFile, setLoadingFile] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);

  const videoRef = useRef(null);

  // On initial render, check if there's saved data and pre-populate the state
  useEffect(() => {
    if (savedData) {
      // savedData is { name, content, config }
      setFileName(savedData.name);
      setFileData({ ...savedData, config: null });
      setFileConfig(savedData.config);
    }
  }, [savedData]);

  // run once when the popup (re)opens
  useEffect(() => {
    (async () => {
      const { state } = await navigator.permissions.query({ name: 'camera' });
      if (state === "granted") {
        setLoadingCamera(true);
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(s);
        setCameraEnabled(true);
        setLoadingCamera(false);
        return;
      }
      const { autoEnableCamera } = await chrome.storage.local.get('autoEnableCamera');
      if (autoEnableCamera === 'denied') {
        // reset the flag so it doesn't loop forever
        chrome.storage.local.remove('autoEnableCamera');
        alert('Camera permission is blocked. Click “Details → Site settings” in the extension page and set Camera → Allow, then try again.');
      } else if (autoEnableCamera === 'prompt') {
        // reset the flag so it doesn't loop forever
        chrome.storage.local.remove('autoEnableCamera');
        alert('Head-tracking needs permanent access. When Chrome asks, choose “Allow while visiting this site”, not “Allow this time”.');
      }
    })();
  }, []);


  // 1. Handle CSV upload
  async function handleChoose(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');
    setLoadingFile(true);
    setFileName(file.name);
    setFileConfig(null);

    try {
      // Read the CSV as text
      const text = await file.text();

      // Get configuration, calibration dimensions, and transformation matrices
      const config = await handleCalibrationUpload(text);

      if (!config) {
        setFileError('Could not process the calibration file. Please re-export from the calibration site or try again.');
        return;
      }

      // Update React state with both name + content + config
      setFileName(file.name);
      setFileData({ name: file.name, content: text });
      setFileConfig(config);

      // Prepare object for storage
      const toSet = {
        isTrackingActive: false,
        calibrationCsvContent: text,
        calibrationCsvName: file.name,
        config: config,
      };

      // Store in chrome.storage.local
      chrome.storage.local.set(toSet, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          setFileError('Failed to save file to memory. Please try again.');
        } else {
          console.log('Calibration file saved to storage.');
        }
      });
    } catch (err) {
      console.error('Calibration processing failed:', err);
      setFileError('Processing failed. Make sure this is a valid .csv file from the calibration site!');
    } finally {
      setLoadingFile(false);
    }
  }

  async function ensureCameraPermission() {
    const { state } = await navigator.permissions.query({ name: 'camera' });
    if (state === 'granted') return true;

    if (state === 'prompt') { // user has the setting on "Ask (Default)"
      // Open the options page (runs getUserMedia & closes itself)
      await chrome.runtime.openOptionsPage();

      // Wait for its result
      return new Promise(resolve => {
        const listener = (msg) => {
          if (msg.cmd === 'CAMERA_GRANTED') {
            resolve(true);
          }
          else if (msg.cmd === 'CAMERA_PROMPT') {
            resolve(false);
          }
          chrome.runtime.onMessage.removeListener(listener);
        };
        chrome.runtime.onMessage.addListener(listener);
      });
    }

    // state === 'denied'
    return false;
  }

  // 2. Toggle camera on/off
  async function handleToggleCamera(e) {
    const wantOn = e.target.checked;
    if (wantOn) {
      setLoadingCamera(true);
      const ok = await ensureCameraPermission();
      if (!ok) {
        alert('Camera permission is blocked. Click “Details → Site settings” in the extension page and set Camera → Allow, then try again.');
        e.target.checked = false;
        setLoadingCamera(false);
        return;
      }
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        setCameraEnabled(true);
      } catch (err) {
        console.error('getUserMedia failed:', err);
        alert('Unable to access camera. Please check your browser or OS-level privacy settings.');
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
    if (loadingFile || loadingCamera) return;
    if (!fileData) return alert('Upload or select a calibration file first.');
    if (!fileConfig) return alert('Your calibration file was not processed. Please re-upload it.');
    if (!cameraEnabled) return alert('Enable camera first.');

    const message = {
      cmd: 'START_TRACKING',
      calibrationCsvName: fileData.name,
      calibrationCsvContent: fileData.content,
      config: fileConfig
    };

    await chrome.runtime.sendMessage(message);

    onSetupComplete();
    window.close();
  }

  return (
    <>
      <h2>Head-Tracking Setup</h2>

      <label className={`file-picker ${fileError ? 'has-error' : ''}`}>
        <input
          type="file"
          accept=".csv"
          onChange={handleChoose}
          hidden
          aria-invalid={!!fileError}
          aria-errormessage={fileError ? 'calibration-error' : undefined}
        />
        <span className="file-name" title={fileName || 'Choose calibration CSV…'}>
          {fileName || 'Choose calibration CSV…'}
          {loadingFile && <span className="inline-spinner" aria-hidden="true" />}
        </span>
      </label>

      {fileError && (
        <div
          id='calibration-error'
          className="alert alert--error"
          role="alert"
          aria-live="polite"
        >
          <span className="alert-icon" aria-hidden="true">!</span>
          <span className="alert-text">{fileError}</span>
        </div>
      )}

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

      <button disabled={!fileData || !cameraEnabled || loadingFile || loadingCamera} onClick={handleStart}>
        Start Head Tracking
      </button>
    </>
  );
}