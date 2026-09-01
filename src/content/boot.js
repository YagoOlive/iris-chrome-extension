// src/content/boot.js
//
// Declarative bootstrap. Registered in manifest.json so Chrome runs it on
// EVERY committed navigation to a matching page — including prerender
// activation (Google -> YouTube) and, via the `pageshow` event, bfcache
// restores. It is intentionally dependency-free and tiny.
//
// Its only job: when head-tracking is active, tell the background to make
// sure the full tracking pipeline is injected and running in this tab. The
// heavy content scripts (mathjs, MediaPipe glue, cursor, etc.) are only
// injected on demand, so pages pay nothing when tracking is off.

(() => {
  if (window.__htBootRan) return;
  window.__htBootRan = true;

  function ensureTracking() {
    try {
      chrome.storage.local.get('isTrackingActive', ({ isTrackingActive }) => {
        if (chrome.runtime.lastError || !isTrackingActive) return;
        chrome.runtime.sendMessage({ cmd: 'ENSURE_TRACKING' }, () => void chrome.runtime.lastError);
      });
    } catch {
      /* extension context invalidated (reload) — ignore */
    }
  }

  ensureTracking();

  // bfcache restore: content scripts are NOT re-executed, but pageshow fires.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) ensureTracking();
  });
})();
