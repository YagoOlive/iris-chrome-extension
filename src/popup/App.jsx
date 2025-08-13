// src/popup/App.jsx

import { useState, useEffect } from 'react';
import './index.css';

import SetupView from './components/SetupView';
import StatusView from './components/StatusView';

// --- Main App Component ---
export default function App() {
  const [view, setView] = useState('loading'); // 'loading', 'setup', 'status'

  // State to hold the saved calibration data from storage
  const [savedCalibrationData, setSavedCalibrationData] = useState(null);

  // This function will be called from both useEffect and the StatusView's onStop handler
  const checkStatus = async () => {
    chrome.storage.local.get(
      ['calibrationCsvContent', 'calibrationCsvName', 'config', 'isTrackingActive'],
      (items) => {
        if (items.calibrationCsvContent && items.calibrationCsvName && items.config) {
          setSavedCalibrationData({
            name: items.calibrationCsvName,
            content: items.calibrationCsvContent,
            config: items.config
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