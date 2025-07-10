// public/content/tracker.js

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

  // 3. The core tracking logic (currently a mouse-follower)
  const follow = e => {
    sprite.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  };

  // 4. Teardown function to clean up JS-related things
  function stopHeadCursor() {
    console.log('Cleaning up tracker script on this page.');
    window.removeEventListener('mousemove', follow);
    if (sprite) sprite.remove();
    
    // The cursor style is now handled by removeCSS in the background script.
    // No need to manage it here anymore.
    
    delete window.__htCursorInjected;
    chrome.runtime.onMessage.removeListener(messageListener);
  }

  // 5. Message listener to handle commands from the background script
  const messageListener = (msg, sender, sendResponse) => {
    if (msg.cmd === 'STOP_TRACKING') {
      stopHeadCursor();
      sendResponse({ ok: true });
    }
    return true;
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // 6. Initialize tracking
  chrome.storage.local.get('calibrationCsv', ({ calibrationCsv }) => {
    if (calibrationCsv) {
      console.log('Calibration data loaded. Starting tracking.');
      // TODO: Initialize your head-tracking algorithm here
      window.addEventListener('mousemove', follow, { passive: true });
    } else {
      console.error('Could not find calibration data in storage. Stopping.');
      stopHeadCursor();
    }
  });

})();