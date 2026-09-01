// src/content/dwell-click.js

(() => {
  let dwellStartTime = null;

  // Countdown timer element
  let dwellTimer = null;

  // Show the countdown only after this fraction of dwellTime has elapsed
  const DWELL_VISUAL_THRESHOLD = 0.10;

  // Total dwell duration in ms (fixed at 3 seconds)
  const DWELL_DURATION_MS = 3000;

  function ensureDwellTimer() {
    const sprite = window.state?.sprite;
    if (!sprite) return false;

    if (dwellTimer && dwellTimer.parentNode && dwellTimer.parentNode !== sprite) {
      destroyDwellRing();
    }

    if (!dwellTimer) {
      dwellTimer = document.createElement('div');
      dwellTimer.className = 'dwell-timer';
      dwellTimer.setAttribute('aria-hidden', 'true');
    }

    if (!dwellTimer.isConnected) {
      sprite.appendChild(dwellTimer);
    }

    return true;
  }

  function createDwellRing() {
    if (dwellTimer?.isConnected) return;
    ensureDwellTimer();
  }

  function destroyDwellRing() {
    dwellTimer?.remove();
    dwellTimer = null;
  }

  function setDwellProgress(p) {
    if (!ensureDwellTimer()) return;

    // p in [0,1] — derive remaining seconds from progress
    const elapsed = p * DWELL_DURATION_MS;
    const remaining = Math.max(0, DWELL_DURATION_MS - elapsed);
    const seconds = Math.ceil(remaining / 1000);

    // Display 3, 2, 1 — clamp to valid range
    const display = Math.min(3, Math.max(1, seconds));
    dwellTimer.textContent = display;

    // Color shifts as time runs out
    if (p > 0.66) {
      dwellTimer.style.color = '#f80c8e';
    } else if (p > 0.33) {
      dwellTimer.style.color = '#fdc203';
    } else {
      dwellTimer.style.color = '#ffffff';
    }
  }

  function showDwellRing(on) {
    if (!ensureDwellTimer()) return;

    window.state.sprite.classList.toggle('dwell-active', !!on);
    if (!on && dwellTimer) {
      dwellTimer.textContent = '';
    }
  }

  function startDwell() {
    if (!ensureDwellTimer()) return;

    state.dwellAnchorX = state.cursorX;
    state.dwellAnchorY = state.cursorY;
    dwellStartTime = Date.now();
    showDwellRing(false);
    setDwellProgress(0);
  }

  function handleDwellClick() {
    if (!ensureDwellTimer()) return;

    if (!state.config.dwellClick || !window.state.readyToTrack || state.boundaryTimer || state.loading) {
      showDwellRing(false);
      return;
    }

    const now = Date.now();

    /* ➊ cooldown → require movement after a dwell fire */
    if (now - state.lastClickTime < state.CLICK_COOLDOWN) {
      showDwellRing(false);
      return;
    }

    /* ➋ initialise if we have no anchor yet */
    if (state.dwellAnchorX === null) {
      startDwell();
      return;
    }

    /* ➌ reset if pointer left the dwell circle */
    const dx = state.cursorX - state.dwellAnchorX;
    const dy = state.cursorY - state.dwellAnchorY;
    if (Math.hypot(dx, dy) > state.config.dwellArea) {
      startDwell();
      return;
    }

    // ➍ inside circle: update progress
    const p = (now - dwellStartTime) / state.config.dwellTime;

    // Show countdown after visual threshold
    if (p >= DWELL_VISUAL_THRESHOLD) {
      showDwellRing(true);
      setDwellProgress(Math.min(p, 1));
    }

    if (p >= 1) {
      const candidate = window.HTClick?.elementFromPointDeep(state.cursorX, state.cursorY);
      let el = window.HTHover?.nearestInteractive(candidate);
      window.HTClick?.cursorClick(el);
    }
  }

  window.HTDwellClick = { createDwellRing, destroyDwellRing, showDwellRing, handleDwellClick };
})();
