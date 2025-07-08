
chrome.runtime.onMessage.addListener(async (msg, _sender, sendResponse) => {
  if (msg.cmd === 'INJECT_TRACKER') {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: msg.tabId },
        files: ['content/cursor.css']
      });

      await chrome.scripting.executeScript({
        target: { tabId: msg.tabId },
        files: ['content/tracker.js']        // guarantees single injection per tab :contentReference[oaicite:7]{index=7}
      });

      sendResponse({ ok: true });
    } catch (e) {
      console.error(e);
      sendResponse({ ok: false, error: e.message });
    }
  }
  return true;      // keep message port open for async
});
