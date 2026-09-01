// src/popup/App.jsx

import { useState, useEffect } from 'react';
import './index.css';

import SetupView from './components/SetupView';
import StatusView from './components/StatusView';

export default function App() {
  const [view, setView] = useState('loading'); // 'loading' | 'setup' | 'status'

  const checkStatus = async () => {
    chrome.storage.local.get(['config', 'calibrationDone', 'isTrackingActive'], (items) => {
      if (items.isTrackingActive) {
        setView('status');
      } else {
        setView('setup');
      }
    });
  };

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    const onMsg = (msg) => {
      if (msg?.cmd === 'CLOSE_POPUP_IF_OPEN') {
        window.close();
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  return (
    <div className="popup">
      {view === 'loading' && <p>Carregando…</p>}
      {view === 'setup' && (
        <SetupView onSetupComplete={() => setView('status')} />
      )}
      {view === 'status' && (
        <StatusView onStop={checkStatus} />
      )}
    </div>
  );
}
