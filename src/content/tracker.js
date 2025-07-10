// src/content/tracker.js

// Use an IIFE to avoid polluting the global scope and run immediately
(() => {
  // 1. Prevent double-injection
  if (window.__htCursorInjected) return;
  window.__htCursorInjected = true;

  console.log('Head-tracking content script injected.');

  // 2. Create and append the cursor sprite
  const sprite = document.createElement('div');
  sprite.id = 'ht-cursor';
  document.documentElement.appendChild(sprite);

  // 3. Hide the OS cursor
  const prevCursor = document.documentElement.style.cursor;
  document.documentElement.style.cursor = 'none';

  // 4. The core tracking logic (currently a mouse-follower)
  const follow = e => {
    sprite.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  };

  // 5. Teardown function to clean up everything
  function stopHeadCursor() {
    console.log('Stopping head tracking on this page.');
    window.removeEventListener('mousemove', follow);
    if (sprite) sprite.remove();
    document.documentElement.style.cursor = prevCursor || 'auto';
    delete window.__htCursorInjected;
    // Important: remove the message listener to prevent memory leaks
    chrome.runtime.onMessage.removeListener(messageListener);
  }

  // 6. Message listener to handle commands from the background script
  const messageListener = (msg, sender, sendResponse) => {
    if (msg.cmd === 'STOP_TRACKING') {
      stopHeadCursor();
      sendResponse({ ok: true });
    }
    return true;
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // 7. Initialize tracking
  // This is where you'll fetch the CSV and start your actual head-tracking model
  chrome.storage.local.get('calibrationCsv', ({ calibrationCsv }) => {
    if (calibrationCsv) {
      console.log('Calibration data loaded. Starting tracking.');
      // ---
      // TODO: Initialize your head-tracking algorithm here using the calibrationCsv data
      // ---

      // For now, we just start the mouse follower
      window.addEventListener('mousemove', follow, { passive: true });
    } else {
      console.error('Could not find calibration data in storage. Stopping.');
      stopHeadCursor();
    }
  });

})();

