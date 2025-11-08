// src/content/dwell-click.js

(() => {
  let dwellStartTime = null;

  // Dwell ring elements
  let dwellRing = null;
  let dwellTrack = null;
  let dwellProg = null;
  let dwellCircumference = 0;

  // Show the dwell ring only after this fraction of dwellTime has elapsed
  const DWELL_VISUAL_THRESHOLD = 0.20;

  function ensureDwellRing() {
    const sprite = window.state?.sprite;
    if (!sprite) return false;

    if (dwellRing && dwellRing.parentNode && dwellRing.parentNode !== sprite) {
      destroyDwellRing();
    }

    if (!dwellRing) {
      // 36x36 viewbox, radius 16 for a tidy ring with 3.5px stroke
      dwellRing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      dwellRing.setAttribute("class", "dwell-ring");
      dwellRing.setAttribute("viewBox", "0 0 36 36");

      dwellTrack = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dwellTrack.setAttribute("class", "track");
      dwellTrack.setAttribute("cx", "18");
      dwellTrack.setAttribute("cy", "18");
      dwellTrack.setAttribute("r", "16");

      dwellProg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dwellProg.setAttribute("class", "progress");
      dwellProg.setAttribute("cx", "18");
      dwellProg.setAttribute("cy", "18");
      dwellProg.setAttribute("r", "16");

      dwellRing.appendChild(dwellTrack);
      dwellRing.appendChild(dwellProg);

      const r = 16;
      dwellCircumference = 2 * Math.PI * r;
    } else if (!dwellRing.isConnected) {
      dwellTrack = dwellRing.querySelector('.track');
      dwellProg = dwellRing.querySelector('.progress');
    }

    if (!dwellRing.isConnected) {
      sprite.appendChild(dwellRing);
    }

    if (dwellProg) {
      dwellProg.style.strokeDasharray = `${dwellCircumference}`;
      dwellProg.style.strokeDashoffset = `${dwellCircumference}`;
    }

    return !!dwellProg;
  }

  function createDwellRing() {
    if (dwellRing?.isConnected && dwellProg) return;
    if (!ensureDwellRing()) {
      destroyDwellRing();
    }
  }

  function destroyDwellRing() {
    dwellRing?.remove();
    dwellTrack?.remove();
    dwellProg?.remove();
    dwellRing = null;
    dwellTrack = null;
    dwellProg = null;
    dwellCircumference = 0;
  }

  function setDwellProgress(p) {
    if (!ensureDwellRing()) return;

    // p in [0,1]
    const clamped = Math.max(0, Math.min(1, p));
    const remaining = (1 - clamped) * dwellCircumference;
    dwellProg.style.strokeDashoffset = `${remaining}`;

    // nudge color as you near completion
    if (clamped > 0.75) {
      dwellProg.style.stroke = getComputedStyle(document.documentElement)
        .getPropertyValue('--dwell-near-done') || '#f80c8e';
    } else {
      dwellProg.style.stroke = getComputedStyle(document.documentElement)
        .getPropertyValue('--dwell-progress') || '#fdc203';
    }
  }

  function showDwellRing(on) {
    if (!ensureDwellRing()) return;

    window.state.sprite.classList.toggle('dwell-active', !!on);
    if (!on && dwellProg) {
      dwellProg.style.strokeDashoffset = `${dwellCircumference}`;
    }
  }

  function startDwell() {
    if (!ensureDwellRing()) return;

    state.dwellAnchorX = state.cursorX;
    state.dwellAnchorY = state.cursorY;
    dwellStartTime = Date.now();
    showDwellRing(false);
    setDwellProgress(0);
  }

  function handleDwellClick() {
    if (!ensureDwellRing()) return;

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

    // At/above threshold → show and map to [0..1] over remaining time
    if (p >= DWELL_VISUAL_THRESHOLD) {
      const q = (p - DWELL_VISUAL_THRESHOLD) / (1 - DWELL_VISUAL_THRESHOLD);
      showDwellRing(true);
      setDwellProgress(q);
    }

    if (p >= 1) {
      const candidate = window.HTClick?.elementFromPointDeep(state.cursorX, state.cursorY);
      let el = window.HTHover?.nearestInteractive(candidate);
      window.HTClick?.cursorClick(el);
    }
  }

  window.HTDwellClick = { createDwellRing, destroyDwellRing, showDwellRing, handleDwellClick }
})();