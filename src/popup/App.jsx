import { useState } from 'react';
import './index.css'

export default function App() {
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState(null);

  function handleChoose(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = evt => setFileData(evt.target.result);
    reader.readAsText(file);
  }

  async function handleStart() {
    if (!fileData) return alert('Upload a calibration file first.');

    // persist calibration file for tracker.js
    await chrome.storage.local.set({ calibrationCsv: fileData });

    // ask background to inject tracker
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ cmd: 'INJECT_TRACKER', tabId: tab.id });
    window.close();
  }

  return (
    <div className="popup">
      <h2>Head-Tracking Cursor</h2>

      <label className="file-picker">
        <input type="file" accept=".csv" onChange={handleChoose} hidden />
        <span>{fileName || 'Choose calibration CSV…'}</span>
      </label>

      <p>
        Don’t have a file?&nbsp;
        <a href="https://head-control-website.vercel.app" target="_blank">Run calibration site</a>
      </p>

      <button disabled={!fileData} onClick={handleStart}>
        Start head tracking
      </button>
    </div>
  );
}
