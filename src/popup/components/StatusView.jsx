import { useState, useEffect } from 'react';
import '../styles/StatusView.css';

const clickActionDescriptions = {
  "": "Select a facial gesture to trigger a left-click.",
  smile: "Smile to perform a left-click.",
  browUp: "Raise your eyebrows to click.",
  jawOpen: "Open your mouth wide to click.",
};

// --- Status View Component ---
export default function StatusView({ onStop }) {

  const [factor, setFactor] = useState(0.95);
  const [clickAction, setClickAction] = useState('');

  const [clickAssist, setClickAssist] = useState(false);
  const [clickTimeout, setClickTimeout] = useState(1000) // default: 1s
  const [clickRadius, setClickRadius] = useState(100); // default: 100px
  const [clickRadiusError, setClickRadiusError] = useState(false);
  const [clickTimeoutError, setClickTimeoutError] = useState(false);


  const [dwellClick, setDwellClick] = useState(false);
  const [dwellTime, setDwellTime] = useState(4000); // default: 4s
  const [dwellArea, setDwellArea] = useState(40); // default: 40px
  const [dwellTimeError, setDwellTimeError] = useState(false);
  const [dwellAreaError, setDwellAreaError] = useState(false);


  /* pull current value on mount */
  useEffect(() => {
    chrome.storage.local.get(
      ['exponentialSmoothingFactor',
        'clickAction',
        'clickAssist',
        'clickTimeout',
        'clickRadius',
        'dwellClick',
        'dwellTime',
        'dwellArea'],
      ({ exponentialSmoothingFactor, clickAction, clickAssist, clickTimeout, clickRadius,
        dwellClick, dwellTime, dwellArea }) => {
        if (typeof exponentialSmoothingFactor === 'number') setFactor(exponentialSmoothingFactor);
        if (typeof clickAction === 'string') setClickAction(clickAction);
        if (clickAssist) setClickAssist(true);
        if (typeof clickTimeout === 'number') setClickTimeout(clickTimeout);
        if (typeof clickRadius === 'number') setClickRadius(clickRadius);
        if (clickTimeout < 100 || clickTimeout > 10000) setClickTimeoutError(true);
        if (clickRadius < 30 || clickRadius > 500) setClickRadiusError(true);
        if (dwellClick) setDwellClick(true);
        if (typeof dwellTime === 'number') setDwellTime(dwellTime);
        if (typeof dwellArea === 'number') setDwellArea(dwellArea);
        if (dwellTime < 300 || dwellTime > 5000) setDwellTimeError(true);
        if (dwellArea < 3 || dwellArea > 100) setDwellAreaError(true);
      });
  }, []);

  // On slider move, update local state only
  const handleSlider = (e) => {
    setFactor(Number(e.target.value));
  };

  const handleToggleClickAssist = (e) => {
    const wantOn = e.target.checked;
    setClickAssist(wantOn);
    chrome.storage.local.set({ clickAssist: wantOn });
    chrome.runtime.sendMessage({
      cmd: 'UPDATE_SETTINGS',
      clickAssist: wantOn
    });
  }

  const handleToggleDwellClick = (e) => {
    const wantOn = e.target.checked;
    setDwellClick(wantOn);
    chrome.storage.local.set({ dwellClick: wantOn });
    chrome.runtime.sendMessage({
      cmd: 'UPDATE_SETTINGS',
      dwellClick: wantOn
    });
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

  const handleClickTimeoutChange = (e) => {
    if (e.target.value === "") {
      setClickTimeout("");
      setClickTimeoutError(true);
      return;
    }
    const val = Number(e.target.value);
    setClickTimeout(val);
    setClickTimeoutError(!(val >= 100 && val <= 10000));
  };

  const handleClickRadiusChange = (e) => {
    if (e.target.value === "") {
      setClickRadius("");
      setClickRadiusError(true);
      return;
    }
    const val = Number(e.target.value);
    setClickRadius(val);
    setClickRadiusError(!(val >= 30 && val <= 500));
  };

  const handleDwellTimeChange = (e) => {
    if (e.target.value === "") {
      setDwellTime("");
      setDwellTimeError(true);
      return;
    }
    const val = Number(e.target.value);
    setDwellTime(val);
    setDwellTimeError(!(val >= 300 && val <= 5000));
  };

  const handleDwellAreaChange = (e) => {
    if (e.target.value === "") {
      setDwellArea("");
      setDwellAreaError(true);
      return;
    }
    const val = Number(e.target.value);
    setDwellArea(val);
    setDwellAreaError(!(val >= 3 && val <= 100));
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

      if (clickTimeout >= 100 && clickTimeout <= 10000) {
        chrome.storage.local.set({ clickTimeout: clickTimeout });
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', clickTimeout: clickTimeout });
      } else {
        chrome.storage.local.set({ clickTimeout: 1000 }); // set to default click assist timeout of 1s
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', clickTimeout: 1000 });
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [clickTimeout]);

  useEffect(() => {
    const timeout = setTimeout(() => {

      if (clickRadius >= 30 && clickRadius <= 500) {
        chrome.storage.local.set({ clickRadius: clickRadius });
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', clickRadius: clickRadius });
      } else {
        chrome.storage.local.set({ clickRadius: 0 }); // disable click assist (by setting click radius to 0px) until user puts valid value
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', clickRadius: 0 });
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [clickRadius]);

  useEffect(() => {
    const timeout = setTimeout(() => {

      if (dwellTime >= 300 && dwellTime <= 5000) {
        chrome.storage.local.set({ dwellTime: dwellTime });
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', dwellTime: dwellTime });
      } else {
        chrome.storage.local.set({ dwellTime: 4000 }); // set to default dwell time of 4s
        chrome.runtime.sendMessage({ cmd: 'UPDATE_SETTINGS', dwellTime: 4000 });
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

        {clickAssist && (
          <div className="toggle-settings-group animate-in">

            <div className="toggle-setting-block">
              <label className={`toggle-sub-setting-label ${clickTimeoutError ? "error-label" : ""}`}>
                Click Assist Timeout (ms)
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={clickTimeout}
                onChange={handleClickTimeoutChange}
                className={`number-input slim-input ${clickTimeoutError ? "input-error" : ""}`}
              />
            </div>
            <div className="toggle-sub-setting-description">Cursor lock expiration time.</div>
            {clickTimeoutError && (
              <div className="validation-message">
                Value must be between 100 and 10000 ms.
              </div>
            )}

            <div className="toggle-setting-block">
              <label className={`toggle-sub-setting-label ${clickRadiusError ? "error-label" : ""}`}>
                Click Assist Radius (px)
              </label>
              <input
                type="number"
                min="30"
                max="500"
                step="10"
                value={clickRadius}
                onChange={handleClickRadiusChange}
                className={`number-input slim-input ${clickRadiusError ? "input-error" : ""}`}
              />
            </div>
            <div className="toggle-sub-setting-description">Movement radius to maintain cursor lock.</div>
            {clickRadiusError && (
              <div className="validation-message">
                Value must be between 30 and 500 px.
              </div>
            )}
          </div>
        )}

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
              <label className={`toggle-sub-setting-label ${dwellTimeError ? "error-label" : ""}`}>
                Dwell Time (ms)
              </label>
              <input
                type="number"
                min="300"
                max="5000"
                step="100"
                value={dwellTime}
                onChange={handleDwellTimeChange}
                className={`number-input slim-input ${dwellTimeError ? "input-error" : ""}`}
              />
            </div>
            <div className="toggle-sub-setting-description">Time to dwell before clicking.</div>
            {dwellTimeError && (
              <div className="validation-message">
                Value must be between 300 and 5000 ms.
              </div>
            )}

            <div className="toggle-setting-block">
              <label className={`toggle-sub-setting-label ${dwellAreaError ? "error-label" : ""}`}>
                Dwell Area (px)
              </label>
              <input
                type="number"
                min="3"
                max="100"
                step="1"
                value={dwellArea}
                onChange={handleDwellAreaChange}
                className={`number-input slim-input ${dwellAreaError ? "input-error" : ""}`}
              />
            </div>
            <div className="toggle-sub-setting-description">Pointer movement allowed while dwelling.</div>
            {dwellAreaError && (
              <div className="validation-message">
                Value must be between 3 and 100 px.
              </div>
            )}
          </div>
        )}

      </section>

      <button onClick={handleStop} className="stop-button">
        Stop Head Tracking
      </button>
    </>
  );
}