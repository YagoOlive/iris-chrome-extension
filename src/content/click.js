// src/content/click.js

(() => {
  // --- Click synthesis that behaves like a human click (crossing shadow DOM) ---
  function dispatchPointer(type, x, y, target, detail = 0) {
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
      detail,
    });
    return target.dispatchEvent(ev);
  }

  function dispatchMouse(type, x, y, target, detail = 1, button = 0) {
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button,
      detail,
    });
    return target.dispatchEvent(ev);
  }

  /**
   * Simulate a left click: pointerdown → mousedown → pointerup → mouseup → click.
   */
  function synthesizeHumanClick(target, x, y, detail = 1) {
    dispatchPointer('pointerover', x, y, target);
    dispatchMouse('mouseover', x, y, target, 0);
    dispatchPointer('pointerenter', x, y, target);
    dispatchMouse('mouseenter', x, y, target, 0);

    dispatchPointer('pointerdown', x, y, target, detail);
    dispatchMouse('mousedown', x, y, target, detail);
    dispatchPointer('pointerup', x, y, target, detail);
    dispatchMouse('mouseup', x, y, target, detail);

    const clickEv = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      detail,
    });
    return target.dispatchEvent(clickEv);
  }

  /**
   * Simulate a right click: mousedown(2) → mouseup(2) → contextmenu.
   */
  function synthesizeRightClick(target, x, y) {
    dispatchMouse('mousedown', x, y, target, 1, 2);
    dispatchMouse('mouseup',   x, y, target, 1, 2);

    const ctxEv = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 2,
      buttons: 2,
      detail: 0,
    });
    target.dispatchEvent(ctxEv);
  }

  function focusEditable(candidateEl) {
    const tag = candidateEl?.tagName?.toLowerCase?.();
    if (tag === 'textarea' || tag === 'input') {
      candidateEl.focus();
    }
  }

  function afterClickDispatch() {
    window.state.lastClickTime = Date.now();
    window.HTDwellClick?.showDwellRing(false);
    state.dwellAnchorX = null;
    state.dwellAnchorY = null;
  }

  function cursorClick(candidateEl) {
    if (!candidateEl || state.loading) return;
    focusEditable(candidateEl);
    synthesizeHumanClick(candidateEl, state.cursorX, state.cursorY);
    afterClickDispatch();
  }

  function cursorDoubleClick(candidateEl) {
    if (!candidateEl || state.loading) return;
    focusEditable(candidateEl);
    synthesizeHumanClick(candidateEl, state.cursorX, state.cursorY, 1);
    synthesizeHumanClick(candidateEl, state.cursorX, state.cursorY, 2);

    const dblClickEvent = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: state.cursorX,
      clientY: state.cursorY,
      button: 0,
      detail: 2,
    });
    candidateEl.dispatchEvent(dblClickEvent);
    afterClickDispatch();
  }

  function cursorRightClick(candidateEl) {
    if (!candidateEl || state.loading) return;
    synthesizeRightClick(candidateEl, state.cursorX, state.cursorY);
    afterClickDispatch();
  }

  // Returns the deepest element at (x,y), descending into any shadow roots.
  function elementFromPointDeep(x, y, root = document) {
    let el = root.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
      const next = el.shadowRoot.elementFromPoint(x, y);
      if (!next || next === el) break;
      el = next;
    }
    return el;
  }

  function resolveClickTarget() {
    const candidate = elementFromPointDeep(state.cursorX, state.cursorY);
    let el = window.HTHover?.nearestInteractive(candidate);

    if (state.config.clickAssist && state.activeInteractiveEl) {
      const now = Date.now();
      const dx = state.cursorX - state.anchorX;
      const dy = state.cursorY - state.anchorY;
      if (
        Math.hypot(dx, dy) <= state.config.clickAssistRadius &&
        now - state.lockStartTime < state.config.clickAssistTimeout
      ) {
        el = state.activeInteractiveEl;
      }
    }
    return el;
  }

  function maybeClick(score) {
    const now = Date.now();
    if (score < state.config.actions.clickThreshold) return;
    if (now - state.lastClickTime < state.CLICK_COOLDOWN) return;
    cursorClick(resolveClickTarget());
  }

  function maybeDoubleClick(score) {
    if (!state.config.actions.doubleClick) return;
    const now = Date.now();
    if (score < state.config.actions.doubleClickThreshold) return;
    if (now - state.lastClickTime < state.CLICK_COOLDOWN) return;
    cursorDoubleClick(resolveClickTarget());
  }

  function maybeRightClick(score) {
    if (!state.config.actions.rightClick) return;
    const now = Date.now();
    if (score < state.config.actions.rightClickThreshold) return;
    if (now - state.lastClickTime < state.CLICK_COOLDOWN) return;
    // Right-click uses the raw element under cursor, not the interactive target,
    // so it opens the context menu of whatever is actually there.
    const el = elementFromPointDeep(state.cursorX, state.cursorY);
    cursorRightClick(el || document.body);
  }

  window.HTClick = {
    elementFromPointDeep,
    cursorClick,
    cursorDoubleClick,
    cursorRightClick,
    maybeClick,
    maybeDoubleClick,
    maybeRightClick,
  };
})();
