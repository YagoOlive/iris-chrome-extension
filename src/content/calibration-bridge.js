// src/content/calibration-bridge.js

(() => {
  if (window.__htxBridge) return;
  window.__htxBridge = true;

  // The calibration website dispatches this event with { filename, csv }
  window.addEventListener('htx:saveCalibration', async (e) => {
    try {
      const detail = e?.detail || {};
      const filename = String(detail.filename || 'calibration.csv');
      const csv = String(detail.csv || '');

      // Hard safety rails
      if (!csv || csv.length > 10_000_000) {
        window.dispatchEvent(new CustomEvent('htx:saveCalibration:ack', {
          detail: { ok: false, error: 'No CSV or too large.' }
        }));
        return;
      }

      const res = await chrome.runtime.sendMessage({
        cmd: 'EXTERNAL_SAVE_CALIBRATION',
        filename,
        csv,
      });

      window.dispatchEvent(new CustomEvent('htx:saveCalibration:ack', {
        detail: res || { ok: false, error: 'No response' }
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('htx:saveCalibration:ack', {
        detail: { ok: false, error: err?.message || 'Unknown error' }
      }));
    }
  }, false);
})();
