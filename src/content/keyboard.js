// src/content/keyboard.js

(() => {
  const HOST_ID = 'ht-keyboard-host';
  const CONTAINER_ID = 'ht-keyboard';
  const HIDE_DELAY = 2000;
  const TRANSITION_MS = 220;
  const CURSOR_SIZE = 24;

  const KEY_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Backspace'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'Enter'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?'],
    ['Space', 'Clear', 'Hide'],
  ];

  let host = null;
  let shadow = null;
  let container = null;
  let hideTimer = null;
  let isVisible = false;

  function ensureUI() {
    if (host?.isConnected) {
      container = shadow.getElementById(CONTAINER_ID);
      return;
    }

    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.position = 'fixed';
    host.style.zIndex = '2147483646';
    host.style.left = '0';
    host.style.bottom = '0';
    host.style.width = '0';
    host.style.height = '0';
    document.documentElement.appendChild(host);

    shadow = host.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content/keyboard.css');
    shadow.appendChild(link);

    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'ht-keyboard ht-hidden';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'On-screen keyboard');
    shadow.appendChild(container);

    buildKeys();

    container.addEventListener('click', onKeyClick, true);
    container.addEventListener('pointerdown', onPointerDown, true);
  }

  function buildKeys() {
    container.replaceChildren();
    KEY_ROWS.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'ht-keyboard-row';
      row.forEach((key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ht-keyboard-key';
        btn.dataset.key = key;
        btn.tabIndex = -1;

        if (key === 'Space') {
          btn.classList.add('is-space');
          btn.textContent = 'Space';
        } else if (key === 'Backspace') {
          btn.classList.add('is-backspace');
          btn.textContent = '⌫';
        } else if (key === 'Enter') {
          btn.classList.add('is-enter');
          btn.textContent = 'Enter';
        } else if (key === 'Clear') {
          btn.classList.add('is-clear');
          btn.textContent = 'Clear';
        } else if (key === 'Hide') {
          btn.classList.add('is-hide');
          btn.textContent = 'Hide';
        } else {
          btn.textContent = key;
        }

        rowEl.appendChild(btn);
      });
      container.appendChild(rowEl);
    });
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
      window.state.keyboardHideTimer = null;
    }
  }

  function hide(immediate = false) {
    if (!container) return;
    clearHideTimer();
    container.classList.remove('is-visible');
    if (immediate) {
      container.classList.add('ht-hidden');
    } else {
      setTimeout(() => container?.classList.add('ht-hidden'), TRANSITION_MS);
    }
    isVisible = false;
    window.state.keyboardVisible = false;
  }

  function show() {
    if (!state.config.keyboard?.enabled) return;
    ensureUI();
    clearHideTimer();
    container.classList.remove('ht-hidden');
    void container.offsetWidth; // force reflow to restart transition
    container.classList.add('is-visible');
    isVisible = true;
    window.state.keyboardVisible = true;
  }

  function scheduleHide() {
    if (!isVisible || hideTimer) return;
    hideTimer = setTimeout(() => {
      hide();
    }, HIDE_DELAY);
    window.state.keyboardHideTimer = hideTimer;
  }

  function handleCursorMove(x, y) {
    if (!isVisible || !container) return;
    const rect = container.getBoundingClientRect();
    const pointerX = x + CURSOR_SIZE / 2;
    const pointerY = y + CURSOR_SIZE / 2;
    const within =
      pointerX >= rect.left &&
      pointerX <= rect.right &&
      pointerY >= rect.top &&
      pointerY <= rect.bottom;

    if (within) {
      clearHideTimer();
    } else {
      scheduleHide();
    }
  }

  function onPointerDown(e) {
    const key = e.target?.closest?.('[data-key]');
    if (key) {
      e.preventDefault();
    }
  }

  function onKeyClick(e) {
    const keyEl = e.target?.closest?.('[data-key]');
    if (!keyEl) return;
    e.preventDefault();
    e.stopPropagation();
    const key = keyEl.dataset.key;
    handleKeyPress(key);
  }

  function handleKeyPress(rawKey) {
    if (!rawKey) return;
    if (rawKey === 'Hide') {
      hide(true);
      return;
    }
    if (rawKey === 'Clear') {
      clearActive();
      return;
    }

    const target = document.activeElement;

    if (!target) return;

    if (rawKey === 'Backspace') {
      backspace(target);
      return;
    }
    if (rawKey === 'Enter') {
      enter(target);
      return;
    }

    const value = rawKey === 'Space' ? ' ' : rawKey;
    insertText(target, value);
  }

  function isTextInput(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const types = ['text', 'search', 'password', 'email', 'url', 'tel', 'number'];
      return types.includes(el.type || 'text');
    }
    return false;
  }

  function insertText(target, text) {
    if (isTextInput(target)) {
      const input = target;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const value = input.value ?? '';
      input.value = value.slice(0, start) + text + value.slice(end);
      const pos = start + text.length;
      input.selectionStart = pos;
      input.selectionEnd = pos;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      return;
    }

    if (target.isContentEditable) {
      document.execCommand('insertText', false, text);
      return;
    }

    document.execCommand('insertText', false, text);
  }

  function backspace(target) {
    if (isTextInput(target)) {
      const input = target;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      if (start === 0 && end === 0) return;
      const value = input.value ?? '';
      const newStart = start === end ? Math.max(0, start - 1) : start;
      input.value = value.slice(0, newStart) + value.slice(end);
      input.selectionStart = newStart;
      input.selectionEnd = newStart;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      return;
    }

    if (target.isContentEditable) {
      document.execCommand('delete');
    } else {
      document.execCommand('delete');
    }
  }

  function enter(target) {
    if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
      insertText(target, '\n');
      return;
    }
    if (target.tagName === 'INPUT') {
      const form = target.form;
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.submit();
        }
      }
      return;
    }
    document.execCommand('insertParagraph');
  }

  function clearActive() {
    const target = document.activeElement;
    if (!target) return;
    if (isTextInput(target)) {
      target.value = '';
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.focus();
    } else if (target.isContentEditable) {
      document.execCommand('selectAll');
      document.execCommand('delete');
    }
  }

  function destroy() {
    clearHideTimer();
    container?.removeEventListener('click', onKeyClick, true);
    container?.removeEventListener('pointerdown', onPointerDown, true);
    container?.remove();
    host?.remove();
    container = null;
    host = null;
    shadow = null;
    isVisible = false;
    window.state.keyboardVisible = false;
  }

  window.HTKeyboard = {
    show,
    hide: () => hide(true),
    handleCursorMove,
    destroy,
  };
})();
