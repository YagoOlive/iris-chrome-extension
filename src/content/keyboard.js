// src/content/keyboard.js

(() => {
  const HOST_ID = 'ht-keyboard-host';
  const CONTAINER_ID = 'ht-keyboard';
  const HIDE_DELAY = 4000;
  const TRANSITION_MS = 220;
  const CURSOR_SIZE = 24;

  const KEY_LAYOUT = [
    [
      { type: 'char', base: '`', shift: '~' },
      { type: 'char', base: '1', shift: '!' },
      { type: 'char', base: '2', shift: '@' },
      { type: 'char', base: '3', shift: '#' },
      { type: 'char', base: '4', shift: '$' },
      { type: 'char', base: '5', shift: '%' },
      { type: 'char', base: '6', shift: '^' },
      { type: 'char', base: '7', shift: '&' },
      { type: 'char', base: '8', shift: '*' },
      { type: 'char', base: '9', shift: '(' },
      { type: 'char', base: '0', shift: ')' },
      { type: 'char', base: '-', shift: '_' },
      { type: 'char', base: '=', shift: '+' },
      { type: 'action', label: 'Backspace', action: 'backspace', width: 1.8 },
    ],
    [
      { type: 'action', label: 'Tab', action: 'tab', width: 1.4 },
      { type: 'char', base: 'q' },
      { type: 'char', base: 'w' },
      { type: 'char', base: 'e' },
      { type: 'char', base: 'r' },
      { type: 'char', base: 't' },
      { type: 'char', base: 'y' },
      { type: 'char', base: 'u' },
      { type: 'char', base: 'i' },
      { type: 'char', base: 'o' },
      { type: 'char', base: 'p' },
      { type: 'char', base: '[', shift: '{' },
      { type: 'char', base: ']', shift: '}' },
      { type: 'char', base: '\\', shift: '|' },
    ],
    [
      { type: 'action', label: 'Caps', action: 'caps', width: 1.6 },
      { type: 'char', base: 'a' },
      { type: 'char', base: 's' },
      { type: 'char', base: 'd' },
      { type: 'char', base: 'f' },
      { type: 'char', base: 'g' },
      { type: 'char', base: 'h' },
      { type: 'char', base: 'j' },
      { type: 'char', base: 'k' },
      { type: 'char', base: 'l' },
      { type: 'char', base: ';', shift: ':' },
      { type: 'char', base: '\'', shift: '"' },
      { type: 'action', label: 'Enter', action: 'enter', width: 1.8 },
    ],
    [
      { type: 'action', label: 'Shift', action: 'shift', width: 2 },
      { type: 'char', base: 'z' },
      { type: 'char', base: 'x' },
      { type: 'char', base: 'c' },
      { type: 'char', base: 'v' },
      { type: 'char', base: 'b' },
      { type: 'char', base: 'n' },
      { type: 'char', base: 'm' },
      { type: 'char', base: ',', shift: '<' },
      { type: 'char', base: '.', shift: '>' },
      { type: 'char', base: '/', shift: '?' },
      { type: 'action', label: 'Shift', action: 'shift', width: 2 },
    ],
    [
      { type: 'action', label: 'Clear', action: 'clear', width: 1.5 },
      { type: 'action', label: 'Space', action: 'space', width: 4.5 },
      { type: 'action', label: 'Hide', action: 'hide', width: 1.5 },
    ],
  ];

  const DEFAULT_ACTION_WIDTH = {
    tab: 1.4,
    caps: 1.6,
    shift: 2,
    enter: 1.8,
    backspace: 1.8,
    space: 4.5,
    clear: 1.5,
    hide: 1.5,
  };

  let host = null;
  let shadow = null;
  let container = null;
  let hideTimer = null;
  let isVisible = false;
  let shiftActive = false;
  let capsActive = false;
  const modifierButtons = {
    shift: [],
    caps: [],
  };
  const charKeyRefs = [];

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

    container.addEventListener('click', onKeyClick, true);
    container.addEventListener('pointerdown', onPointerDown, true);

    buildKeys();
  }

  function buildKeys() {
    modifierButtons.shift = [];
    modifierButtons.caps = [];
    charKeyRefs.length = 0;
    container.replaceChildren();
    KEY_LAYOUT.forEach((rowKeys, rowIndex) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'ht-keyboard-row';
      rowEl.dataset.row = String(rowIndex);
      rowKeys.forEach((keyDef) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ht-keyboard-key';
        btn.tabIndex = -1;
        btn.__keyDef = keyDef;
        const width = keyDef.width ?? DEFAULT_ACTION_WIDTH[keyDef.action] ?? 1;
        btn.style.flex = `${width} 1 0`;
        if (keyDef.type === 'char') {
          btn.classList.add('is-char');
          const cap = document.createElement('span');
          cap.className = 'ht-keycap';
          let secondaryEl = null;
          if (keyDef.shift) {
            secondaryEl = document.createElement('span');
            secondaryEl.className = 'ht-keycap-secondary';
            cap.appendChild(secondaryEl);
          }
          const primaryEl = document.createElement('span');
          primaryEl.className = 'ht-keycap-primary';
          cap.appendChild(primaryEl);
          btn.appendChild(cap);
          charKeyRefs.push({ def: keyDef, element: btn, primaryEl, secondaryEl });
        } else {
          btn.classList.add('is-action');
          btn.textContent = keyDef.label;
          btn.setAttribute('data-action', keyDef.action);
          if (keyDef.action === 'shift') {
            modifierButtons.shift.push(btn);
          } else if (keyDef.action === 'caps') {
            modifierButtons.caps.push(btn);
          }
        }
        rowEl.appendChild(btn);
      });
      container.appendChild(rowEl);
    });
    updateKeyLabels();
    updateModifierClasses();
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
    shiftActive = false;
    updateModifierClasses();
    updateKeyLabels();
  }

  function show() {
    if (!state.config.keyboard?.enabled) return;
    ensureUI();
    updateKeyLabels();
    updateModifierClasses();
    clearHideTimer();
    container.classList.remove('ht-hidden');
    void container.offsetWidth; // force reflow to restart transition
    container.classList.add('is-visible');
    isVisible = true;
    window.state.keyboardVisible = true;
  }

  function onPointerDown(e) {
    const key = e.target?.closest?.('.ht-keyboard-key');
    if (key) {
      e.preventDefault();
    }
  }

  function onKeyClick(e) {
    const keyEl = e.target?.closest?.('.ht-keyboard-key');
    if (!keyEl) return;
    e.preventDefault();
    e.stopPropagation();
    const keyDef = keyEl.__keyDef;
    if (!keyDef) return;
    handleKeyPress(keyDef);
  }

  function handleKeyPress(def) {
    if (def.type === 'action') {
      switch (def.action) {
        case 'hide':
          hide(true);
          return;
        case 'clear':
          clearActive();
          return;
        case 'backspace':
          backspace(document.activeElement);
          return;
        case 'enter':
          enter(document.activeElement);
          return;
        case 'tab':
          insertText(document.activeElement, '\t');
          applyShiftRelease();
          return;
        case 'caps':
          capsActive = !capsActive;
          updateModifierClasses();
          updateKeyLabels();
          return;
        case 'shift':
          shiftActive = !shiftActive;
          updateModifierClasses();
          updateKeyLabels();
          return;
        case 'space':
          insertText(document.activeElement, ' ');
          applyShiftRelease();
          return;
        default:
          return;
      }
    }
    const target = document.activeElement;
    if (!target) return;
    const char = resolveCharacter(def);
    if (!char) return;
    insertText(target, char);
    applyShiftRelease();
  }

  function resolveCharacter(def) {
    if (!def || def.type !== 'char') return '';
    const base = def.base ?? '';
    const isLetter = /^[a-z]$/i.test(base);
    if (isLetter) {
      const shouldUpper = shiftActive !== capsActive;
      return shouldUpper ? base.toUpperCase() : base.toLowerCase();
    }
    if (shiftActive && def.shift) {
      return def.shift;
    }
    return base;
  }

  function applyShiftRelease() {
    if (shiftActive) {
      shiftActive = false;
      updateModifierClasses();
      updateKeyLabels();
    }
  }

  function updateKeyLabels() {
    charKeyRefs.forEach(({ def, primaryEl, secondaryEl }) => {
      if (!primaryEl) return;
      if (secondaryEl) {
        if (def.shift) {
          secondaryEl.textContent = def.shift;
          secondaryEl.hidden = false;
        } else {
          secondaryEl.textContent = '';
          secondaryEl.hidden = true;
        }
      }
      primaryEl.textContent = resolveCharacterLabel(def);
    });
  }

  function resolveCharacterLabel(def) {
    if (!def || def.type !== 'char') return '';
    const base = def.base ?? '';
    const isLetter = /^[a-z]$/i.test(base);
    if (isLetter) {
      const shouldUpper = shiftActive !== capsActive;
      return shouldUpper ? base.toUpperCase() : base.toLowerCase();
    }
    if (shiftActive && def.shift) {
      return def.shift;
    }
    return def.base;
  }

  function updateModifierClasses() {
    modifierButtons.shift.forEach((btn) => {
      btn.classList.toggle('is-active', shiftActive);
    });
    modifierButtons.caps.forEach((btn) => {
      btn.classList.toggle('is-active', capsActive);
    });
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

  // function onPointerDown(e) {
  //   const key = e.target?.closest?.('[data-key]');
  //   if (key) {
  //     e.preventDefault();
  //   }
  // }

  // function onKeyClick(e) {
  //   const keyEl = e.target?.closest?.('[data-key]');
  //   if (!keyEl) return;
  //   e.preventDefault();
  //   e.stopPropagation();
  //   const key = keyEl.dataset.key;
  //   handleKeyPress(key);
  // }

  // function handleKeyPress(rawKey) {
  //   if (!rawKey) return;
  //   if (rawKey === 'Hide') {
  //     hide(true);
  //     return;
  //   }
  //   if (rawKey === 'Clear') {
  //     clearActive();
  //     return;
  //   }

  //   const target = document.activeElement;

  //   if (!target) return;

  //   if (rawKey === 'Backspace') {
  //     backspace(target);
  //     return;
  //   }
  //   if (rawKey === 'Enter') {
  //     enter(target);
  //     return;
  //   }

  //   const value = rawKey === 'Space' ? ' ' : rawKey;
  //   insertText(target, value);
  // }

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
    if (!target) return;
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

    if (target?.isContentEditable) {
      document.execCommand('insertText', false, text);
      return;
    }

    document.execCommand('insertText', false, text);
  }

  function backspace(target) {
    if (!target) return;
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
      applyShiftRelease();
      return;
    }

    if (target?.isContentEditable) {
      document.execCommand('delete');
      applyShiftRelease();
    } else {
      document.execCommand('delete');
      applyShiftRelease();
    }
  }

  function enter(target) {
    if (!target) return;
    if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
      insertText(target, '\n');
      applyShiftRelease();
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
      applyShiftRelease();
      return;
    }
    document.execCommand('insertParagraph');
    applyShiftRelease();
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
    shiftActive = false;
    capsActive = false;
    window.state.keyboardVisible = false;
  }

  window.HTKeyboard = {
    show,
    hide: () => hide(true),
    handleCursorMove,
    destroy,
  };
})();
