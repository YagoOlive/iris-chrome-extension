// src/content/hover.js

(() => {
  let lastHoverEl = null;

  const INTERACTIVE_SEL =
    'a[href], button, input, select, textarea, label, [role="button"], [onclick]';

  // ---------- Lock Highlight management ----------
  const HIGHLIGHT_ID = 'ht-lock-highlight';
  const PAD = 6; // padding around the element inside the halo

  let highlightEl = null;
  let raf = 0;

  function ensureHighlight() {
    if (!highlightEl) {
      highlightEl = document.getElementById(HIGHLIGHT_ID);
      if (!highlightEl) {
        highlightEl = document.createElement('div');
        highlightEl.id = HIGHLIGHT_ID;
        // Use <html> as the container to avoid transforms on <body>
        document.documentElement.appendChild(highlightEl);
      }
    }
    return highlightEl;
  }

  function positionHighlightFor(target) {
    if (!target || !highlightEl) return;
    // Viewport-based rect => use position:fixed on the overlay
    const r = target.getBoundingClientRect();
    const x = Math.round(r.left - PAD);
    const y = Math.round(r.top - PAD);
    const w = Math.round(r.width + PAD * 2);
    const h = Math.round(r.height + PAD * 2);

    // Try to mirror the element's corner rounding for a polished look
    const cs = getComputedStyle(target);
    const br = cs.borderRadius || '8px';

    const t = `translate3d(${x}px, ${y}px, 0)`;
    if (highlightEl.style.transform !== t) highlightEl.style.transform = t;
    if (highlightEl.style.width !== `${w}px`) highlightEl.style.width = `${w}px`;
    if (highlightEl.style.height !== `${h}px`) highlightEl.style.height = `${h}px`;
    if (highlightEl.style.borderRadius !== br) highlightEl.style.borderRadius = br;
  }

  function startFollowLoop() {
    if (raf) return;
    const step = () => {
      if (!state.config?.clickAssist || !state.activeInteractiveEl) {
        raf = 0;
        return;
      }
      positionHighlightFor(state.activeInteractiveEl);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function showHighlightFor(target) {
    ensureHighlight();
    positionHighlightFor(target);
    highlightEl.classList.add('is-visible', 'is-locked');
    startFollowLoop();
  }

  function hideHighlight() {
    if (!highlightEl) return;
    highlightEl.classList.remove('is-visible', 'is-locked');
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function destroyHighlight() {
    hideHighlight();
    highlightEl?.remove();
    highlightEl = null;
  }

  // Keep the halo aligned on scroll/resize (works across nested scrollers)
  window.addEventListener(
    'scroll',
    () => state.activeInteractiveEl && positionHighlightFor(state.activeInteractiveEl),
    { passive: true, capture: true }
  );
  window.addEventListener(
    'resize',
    () => state.activeInteractiveEl && positionHighlightFor(state.activeInteractiveEl),
    { passive: true }
  );

  function nearestInteractive(el) {
    if (!el) return null;
    const close = el.closest('.ht-close-hit'); // Edge Case #1: Hovering over close button on a tab
    if (close) return close; // promote close target above the tab button
    return el.closest(INTERACTIVE_SEL) || el; // falls back to the raw element
  }

  function recordLock() {
    window.state.anchorX = state.cursorX;
    window.state.anchorY = state.cursorY;
    window.state.lockStartTime = Date.now();
  }

  // ---------- Hover / Click-Assist logic ----------
  function updateHover() {
    if (state.loading) return;

    const candidate = window.HTClick?.elementFromPointDeep(state.cursorX, state.cursorY);
    const candidateInteractive = nearestInteractive(candidate);
    let el = candidateInteractive;

    const isInteractive = !!el && el.matches(INTERACTIVE_SEL);
    const now = Date.now();

    if (state.config.clickAssist) {
      // Maintain an existing lock while within radius/time, with the close-hit priority
      if (state.activeInteractiveEl && isInteractive && candidateInteractive === state.activeInteractiveEl) {
        // if the pointer is still inside the interactive element, record a new anchor point
        recordLock();
      } else if (state.activeInteractiveEl) { // exited the interactive element
        if (candidateInteractive?.matches?.('.ht-close-hit') && now - state.lockStartTime > 250) {
          state.activeInteractiveEl = candidateInteractive;
          recordLock();
          el = state.activeInteractiveEl;
        } else {
          const dx = state.cursorX - state.anchorX;
          const dy = state.cursorY - state.anchorY;
          const withinRadius =
            Math.hypot(dx, dy) <= state.config.clickAssistRadius &&
            now - state.lockStartTime < state.config.clickAssistTimeout;

          if (withinRadius) {
            el = state.activeInteractiveEl; // stay locked
          } else {
            state.activeInteractiveEl = null; // unlock
            hideHighlight();
          }
        }
      }

      // Acquire a new lock
      if (!state.activeInteractiveEl && candidateInteractive && isInteractive) {
        state.activeInteractiveEl = candidateInteractive;
        recordLock();
        el = state.activeInteractiveEl;
        showHighlightFor(state.activeInteractiveEl);
      }

      // If click assist is on but no active lock, make sure halo is hidden
      if (!state.activeInteractiveEl) hideHighlight();
    } else {
      // Click Assist off: ensure halo is hidden
      hideHighlight();
      state.activeInteractiveEl = null;
    }

    if (el !== lastHoverEl) {
      lastHoverEl?.classList.remove('ht-hover');
      if (el) el.classList.add('ht-hover');
      lastHoverEl = el;
    }

    if (state.config.clickAssist) {
      window.state.sprite.classList.toggle('hovering-link', !!state.activeInteractiveEl);
    } else {
      window.state.sprite.classList.toggle('hovering-link', isInteractive);
    }
  }

  window.HTHover = {
    nearestInteractive,
    updateHover,
    clearHighlight: hideHighlight,
    destroyHighlight,
  };
})();
