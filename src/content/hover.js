(() => {
  let lastHoverEl = null;

  const INTERACTIVE_SEL =
    'a[href], button, input, select, textarea, label, [role="button"], [onclick]';

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

  // ----- Hover-Effect ----------------------------------------------------
  function updateHover() {
    if (state.loading) return;
    const candidate = window.HTClick?.elementFromPointDeep(state.cursorX, state.cursorY);
    const candidateInteractive = nearestInteractive(candidate);
    let el = candidateInteractive;

    const isInteractive = !!el && el.matches(INTERACTIVE_SEL);

    const now = Date.now();

    if (state.config.clickAssist) {
      /* -------- ➊ maintain existing lock -------- */
      // if the pointer is still inside the interactive element, record a new anchor point
      if (state.activeInteractiveEl && isInteractive && candidateInteractive === state.activeInteractiveEl) {
        recordLock();
      } else if (state.activeInteractiveEl) { // exited the interactive element ⇒ check if still in click radius buffer and time has not expired

        // Edge Case: If the pointer is over the .ht-close-hit button, prioritize switching into it.
        if (candidateInteractive?.matches?.('.ht-close-hit') && now - state.lockStartTime > 250) {
          state.activeInteractiveEl = candidateInteractive;
          recordLock();
          el = state.activeInteractiveEl;
        } else {
          const dx = state.cursorX - state.anchorX;
          const dy = state.cursorY - state.anchorY;
          if (Math.hypot(dx, dy) <= state.config.clickAssistRadius && now - state.lockStartTime < state.config.clickAssistTimeout) {
            el = state.activeInteractiveEl; // stay locked
          } else {
            state.activeInteractiveEl = null; // radius broken ⇒ unlock
          }
        }
      }

      /* -------- ➋ acquire new lock -------- */
      if (!state.activeInteractiveEl && candidateInteractive && isInteractive) {
        state.activeInteractiveEl = candidateInteractive;
        recordLock();
        el = state.activeInteractiveEl;
      }
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
  window.HTHover = { nearestInteractive, updateHover }
})();
