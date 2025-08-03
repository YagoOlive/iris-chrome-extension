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

const clickActionDescriptions = {
  "": "Select a facial gesture to trigger a left-click.",
  smile: "Smile to perform a left-click.",
  browUp: "Raise your eyebrows to click.",
  jawOpen: "Open your mouth wide to click.",
};

// --- Status View Component ---
function StatusView({ onStop }) {

  const [factor, setFactor] = useState(0.95);
  const [clickAssist, setClickAssist] = useState(false);
  const [clickAction, setClickAction] = useState('');

  const [dwellClick, setDwellClick] = useState(false);
  const [dwellTime, setDwellTime] = useState(1000); // default: 1s
  const [dwellArea, setDwellArea] = useState(20); // default: 20px


  /* pull current value on mount */
  useEffect(() => {
    chrome.storage.local.get(
      ['exponentialSmoothingFactor',
        'clickAction',
        'clickAssist',
        'dwellClick',
        'dwellTime',
        'dwellArea'],
      ({ exponentialSmoothingFactor, clickAssist, clickAction, dwellClick, dwellTime, dwellArea }) => {
        if (typeof exponentialSmoothingFactor === 'number') setFactor(exponentialSmoothingFactor);
        if (typeof clickAction === 'string') setClickAction(clickAction);
        if (clickAssist) setClickAssist(true);
        if (dwellClick) setDwellClick(true);
        if (typeof dwellTime === 'number') setDwellTime(dwellTime);
        if (typeof dwellArea === 'number') setDwellArea(dwellArea);
      });
  }, []);

  // On slider move, update local state only
  const handleSlider = (e) => {
    setFactor(Number(e.target.value));
  };

  const handleToggleClickAssist = (e) => {
    const wantOn = e.target.checked;
    if (wantOn) {
      setClickAssist(true);
      chrome.storage.local.set({ clickAssist: true });
      chrome.runtime.sendMessage({
        cmd: 'UPDATE_SETTINGS',
        clickAssist: true
      });
    } else {
      setClickAssist(false);
      chrome.storage.local.set({ clickAssist: false });
      chrome.runtime.sendMessage({
        cmd: 'UPDATE_SETTINGS',
        clickAssist: false
      });
    }
  }

  const handleToggleDwellClick = (e) => {
    const wantOn = e.target.checked;
    if (wantOn) {
      setDwellClick(true);
      chrome.storage.local.set({ dwellClick: true });
      chrome.runtime.sendMessage({
        cmd: 'UPDATE_SETTINGS',
        dwellClick: true
      });
    } else {
      setDwellClick(false);
      chrome.storage.local.set({ dwellClick: false });
      chrome.runtime.sendMessage({
        cmd: 'UPDATE_SETTINGS',
        dwellClick: false
      });
    }
  }

  const handleClickActionChange = (e) => {
    const val = e.target.value;
    setClickAction(val);
    chrome.storage.local.set({ clickAction: val });
    chrome.runtime.sendMessage({
      cmd: 'UPDATE_SETTINGS',
      clickAction: val
    });
  }

  const handleDwellTimeChange = (e) => {
    if (e.target.value === "") {
      setDwellTime("");
      return;
    }
    const val = Number(e.target.value);
    setDwellTime(val);
  };

  const handleDwellAreaChange = (e) => {
    if (e.target.value === "") {
      setDwellTime("");
      return;
    }
    const val = Number(e.target.value);
    setDwellArea(val);
  };

  // Debounce: after factor stops changing for some ms, persist & broadcast
  useEffect(() => {
    const timeout = setTimeout(() => {
      chrome.storage.local.set({ exponentialSmoothingFactor: factor });
      chrome.runtime.sendMessage({
        cmd: 'UPDATE_SETTINGS',
        exponentialSmoothingFactor: factor
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [factor]);

  useEffect(() => {
    const timeout = setTimeout(() => {

      if (dwellTime >= 300 && dwellTime <= 5000) {
        chrome.storage.local.set({ dwellTime: dwellTime });
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', dwellTime: dwellTime });
      } else {
        chrome.storage.local.set({ dwellTime: 1000 }); // set to default dwell time of 1s
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', dwellTime: 1000 });
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [dwellTime]);

  useEffect(() => {
    const timeout = setTimeout(() => {

      if (dwellArea >= 3 && dwellArea <= 100) {
        chrome.storage.local.set({ dwellArea: dwellArea });
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', dwellArea: dwellArea });
      } else {
        chrome.storage.local.set({ dwellArea: 0 }); // disable dwell click (by setting dwell area to 0px) until user puts valid value
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', dwellArea: 0 });
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [dwellArea]);

  async function handleStop() {
    await chrome.runtime.sendMessage({ cmd: 'STOP_TRACKING' });
    onStop();
    window.close();
  }

  return (
    <>
      <h2>Head-Tracking is Active</h2>
      <p>The custom cursor is now active on your web pages.</p>

      {/* SETTINGS */}
      <section className="settings">
        <h3 className="settings-heading">Settings</h3>

        {/* Smoothing Filter Slider */}
        <div className="setting-block">
          <div className="setting-label">
            Smoothing Filter <span className="factor-value">({factor.toFixed(2)})</span>
          </div>
          <div className="setting-description">
            Lower values respond faster. Higher values feel smoother.
          </div>
          <input
            type="range"
            min="0.5"
            max="0.99"
            step="0.01"
            value={factor}
            onChange={handleSlider}
            className="slider"
          />
        </div>

        {/* Click Action Selection */}
        <div className="setting-block">
          <div className="setting-label">Click Action</div>
          <div className="setting-description">
            {clickActionDescriptions[clickAction] || clickActionDescriptions[""]}
          </div>
          <select
            value={clickAction}
            onChange={handleClickActionChange}
            className="dropdown"
          >
            <option value="">None</option>
            <option value="smile">Smile</option>
            <option value="browUp">Raise Eyebrows</option>
            <option value="jawOpen">Open Jaw</option>
          </select>
        </div>

        {/* Click Assist Toggle */}
        <div className="setting-block toggle-setting">
          <span className="setting-toggle-label">Enable Click Assist</span>
          <label className="switch-label switch-right">
            <input type="checkbox" checked={clickAssist} onChange={handleToggleClickAssist} />
            <span className="switch-slider"></span>
          </label>
        </div>

        {/* Dwell Click Toggle */}
        <div className="setting-block toggle-setting">
          <span className="setting-toggle-label">Enable Dwell Click</span>
          <label className="switch-label switch-right">
            <input type="checkbox" checked={dwellClick} onChange={handleToggleDwellClick} />
            <span className="switch-slider"></span>
          </label>
        </div>

        {dwellClick && (
          <div className="toggle-settings-group animate-in">

            <div className="toggle-setting-block">
              <label className="toggle-sub-setting-label">Dwell Time (ms)</label>
              <input
                type="number"
                min="300"
                max="5000"
                step="100"
                value={dwellTime}
                onChange={handleDwellTimeChange}
                className="number-input slim-input"
              />
            </div>
            <div className="toggle-sub-setting-description">Time to dwell before clicking.</div>

            <div className="toggle-setting-block">
              <label className="toggle-sub-setting-label">Dwell Area (px)</label>
              <input
                type="number"
                min="3"
                max="100"
                step="1"
                value={dwellArea}
                onChange={handleDwellAreaChange}
                className="number-input slim-input"
              />
            </div>
            <div className="toggle-sub-setting-description">Pointer movement allowed while dwelling.</div>

          </div>
        )}

      </section>

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