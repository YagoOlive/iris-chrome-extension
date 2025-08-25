(() => {
  // --- Click synthesis that behaves like a human click (crossing shadow DOM) ---
  function dispatchPointer(type, x, y, target) {
    const ev = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: x,
      clientY: y,
      buttons: type === 'pointerdown' ? 1 : 0,
    });
    return target.dispatchEvent(ev);
  }

  function dispatchMouse(type, x, y, target) {
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0
    });
    return target.dispatchEvent(ev);
  }

  /**
   * Simulate a "real" left click: pointerdown → mousedown → pointerup → mouseup → click.
   * Returns true if the final click's default was NOT prevented.
   */
  function synthesizeHumanClick(target, x, y) {
    // order matters
    dispatchPointer('pointerover', x, y, target);
    dispatchMouse('mouseover', x, y, target);
    dispatchPointer('pointerenter', x, y, target);
    dispatchMouse('mouseenter', x, y, target);

    dispatchPointer('pointerdown', x, y, target);
    dispatchMouse('mousedown', x, y, target);
    dispatchPointer('pointerup', x, y, target);
    dispatchMouse('mouseup', x, y, target);

    const clickEv = new MouseEvent('click', {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: x, clientY: y, button: 0
    });
    return target.dispatchEvent(clickEv); // false => defaultPrevented
  }

  function cursorClick(candidateEl) {
    if (!candidateEl || state.loading) return;

    // Inputs need focus first
    const tag = candidateEl.tagName?.toLowerCase?.();
    if (tag === 'textarea' || tag === 'input') {
      candidateEl.focus();
    }

    // use HTMLElement.click() function or synthesizeHumanClick() function
    // candidateEl.click();
    synthesizeHumanClick(candidateEl, state.cursorX, state.cursorY);

    window.state.lastClickTime = Date.now();
    window.HTDwellClick?.showDwellRing(false);
    state.dwellAnchorX = null;
    state.dwellAnchorY = null;
  }

  // Returns the deepest element at (x,y), descending into any shadow roots.
  function elementFromPointDeep(x, y, root = document) {
    let el = root.elementFromPoint(x, y);
    // Descend through nested shadow roots, if any
    while (el && el.shadowRoot) {
      const next = el.shadowRoot.elementFromPoint(x, y);
      if (!next || next === el) break;
      el = next;
    }
    return el;
  }

  // ----- Click on facial expression ----------------------------------------------------
  function maybeClick(score) {
    const now = Date.now();
    if (score < state.config.actions.clickThreshold) return;
    if (now - state.lastClickTime < state.CLICK_COOLDOWN) return;

    // ① find element under the virtual cursor
    const candidate = elementFromPointDeep(state.cursorX, state.cursorY);
    let el = window.HTHover?.nearestInteractive(candidate);

    if (state.config.clickAssist && state.activeInteractiveEl) {
      const dx = state.cursorX - state.anchorX;
      const dy = state.cursorY - state.anchorY;
      if (Math.hypot(dx, dy) <= state.config.clickAssistRadius && now - state.lockStartTime < state.config.clickAssistTimeout) {
        el = state.activeInteractiveEl; // honor the lock
      }
    }
    cursorClick(el);
  }

  window.HTClick = { elementFromPointDeep, cursorClick, maybeClick }
})();
