// src/content/tabstrip.js

// Minimal Material-like SVGs (24px viewBox). Adjust stroke/fill if desired.
const icons = (() => {
  const svg = (d, opts = {}) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('width', opts.size || '20');
    el.setAttribute('height', opts.size || '20');
    el.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', opts.fill || 'currentColor');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const g2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const g3 = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    if (d == PATHS.refresh || d == PATHS.chevronL || d == PATHS.chevronR) {
      g.setAttribute('id', 'SVGRepo_bgCarrier');
      g.setAttribute('stroke-width', '0');
      g2.setAttribute('id', 'SVGRepo_tracerCarrier');
      g2.setAttribute('stroke-linecap', 'round');
      g2.setAttribute('stroke-linejoin', 'round');
      g3.setAttribute('id', 'SVGRepo_iconCarrier');
      el.appendChild(g);
      el.appendChild(g2);
      g3.appendChild(p);
      el.appendChild(g3);
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
    } else {
      el.appendChild(p);
    }
    return el;
  };
  // Rounded-ish variants
  const PATHS = {
    add: 'M12 5c.55 0 1 .45 1 1v5h5c.55 0 1 .45 1 1s-.45 1-1 1h-5v5c0 .55-.45 1-1 1s-1-.45-1-1v-5H6c-.55 0-1-.45-1-1s.45-1 1-1h5V6c0-.55.45-1 1-1z',
    close: 'M6.4 6.4c.39-.39 1.02-.39 1.41 0L12 10.59l4.19-4.19a1 1 0 1 1 1.41 1.41L13.41 12l4.19 4.19a1 1 0 1 1-1.41 1.41L12 13.41l-4.19 4.19a1 1 0 1 1-1.41-1.41L10.59 12 6.4 7.81a1 1 0 0 1 0-1.41z',
    search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99a1 1 0 1 0 1.41-1.41L15.5 14zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.505 4.505 0 0 1 9.5 14z',
    refresh: 'M21 3V8M21 8H16M21 8L18 5.29168C16.4077 3.86656 14.3051 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.2832 21 19.8675 18.008 20.777 14',
    arrowBack: 'M20 11H7.83l5.59-5.59A1 1 0 1 0 12 4l-8 8 8 8a1 1 0 1 0 1.41-1.41L7.83 13H20a1 1 0 1 0 0-2z',
    arrowFwd: 'M4 13h12.17l-5.59 5.59A1 1 0 1 0 12 20l8-8-8-8a1 1 0 1 0-1.41 1.41L16.17 11H4a1 1 0 1 0 0 2z',
    chevronL: 'M15 6L9 12L15 18',
    chevronR: 'M9 6L15 12L9 18',
    plus: 'M12 5c.55 0 1 .45 1 1v5h5c.55 0 1 .45 1 1s-.45 1-1 1h-5v5c0 .55-.45 1-1 1s-1-.45-1-1v-5H6c-.55 0-1-.45-1-1s.45-1 1-1h5V6c0-.55.45-1 1-1z',
  };
  return {
    add: () => svg(PATHS.add),
    close: () => svg(PATHS.close),
    search: () => svg(PATHS.search, { size: 18 }),
    refresh: () => svg(PATHS.refresh, { size: 15, fill: 'none' }),
    arrowBack: () => svg(PATHS.arrowBack, { size: 15 }),
    arrowForward: () => svg(PATHS.arrowFwd, { size: 15 }),
    chevronL: () => svg(PATHS.chevronL, { size: 14, fill: 'none' }),
    chevronR: () => svg(PATHS.chevronR, { size: 14, fill: 'none' }),
    plus: () => svg(PATHS.plus, { size: 18 }),
  };
})();

(() => {
  const CONTAINER_ID = 'ht-tabstrip';
  const LIST_ID = 'ht-tabstrip-list';
  const HIDE_DELAY_DEFAULT = 2000;
  const TRANSITION_DELAY_DEFAULT = 510;

  let container, list, hideTimer;

  let host, shadow;

  function showWait() {
    try {
      window.HTCursor?.showWait?.();
    } catch { /* error during call */ }
  }

  function ensureUI() {
    if (host?.isConnected) {
      container = shadow.getElementById(CONTAINER_ID);
      list = shadow.getElementById(LIST_ID);
      return;
    }

    // Create a host in the page and attach a shadow root
    host = document.createElement('div');
    host.id = 'ht-tabstrip-host';
    // Keep host out of layout flow and above everything
    host.style.position = 'fixed';
    host.style.zIndex = '2147483646';
    host.style.left = '0';
    host.style.top = '0';
    host.style.width = '0';
    host.style.height = '0';
    document.documentElement.appendChild(host);

    shadow = host.attachShadow({ mode: 'open' });

    // Load the tabstrip CSS inside the shadow (prevents page CSS bleed)
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content/tabstrip.css');
    shadow.appendChild(link);

    // Build the UI in the shadow
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Tab switcher');
    container.className = 'ht-hidden';

    const inner = document.createElement('div');
    inner.className = 'ht-tabstrip-inner';

    // Title
    const title = document.createElement('div');
    title.className = 'ht-tabstrip-title';
    title.textContent = 'Tabs';

    // Row 1: tabs grid
    list = document.createElement('div');
    list.id = LIST_ID;
    list.className = 'ht-tabs';

    // Row 2: nav + omnibox
    const controls = document.createElement('div');
    controls.className = 'ht-controls';

    const mkCtrl = (cls, label, action, iconNode) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ht-ctrl ${cls}`;
      b.setAttribute('data-action', action);
      b.setAttribute('aria-label', label);
      b.appendChild(iconNode);
      return b;
    };

    const backBtn = mkCtrl('ht-back', 'Go back', 'back', icons.arrowBack());
    const fwdBtn = mkCtrl('ht-fwd', 'Go forward', 'forward', icons.arrowForward());
    const refBtn = mkCtrl('ht-refresh', 'Refresh', 'reload', icons.refresh());

    const omni = document.createElement('form');
    omni.className = 'ht-omnibox';
    omni.setAttribute('data-omnibox', '1');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search or type a URL';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('focus', onOmniboxFocus);

    const go = document.createElement('button');
    go.type = 'submit';
    go.className = 'ht-go';
    go.setAttribute('aria-label', 'Open in new tab');
    go.appendChild(icons.search());

    omni.appendChild(input);
    omni.appendChild(go);

    controls.appendChild(backBtn);
    controls.appendChild(fwdBtn);
    controls.appendChild(refBtn);
    controls.appendChild(omni);

    inner.appendChild(title);
    inner.appendChild(list);
    inner.appendChild(controls);
    container.appendChild(inner);
    shadow.appendChild(container);

    // Events on the shadow root
    container.addEventListener('click', onClick, true);
    container.addEventListener('submit', onSubmit, true);
  }

  function onSubmit(e) {
    const form = e.target.closest('[data-omnibox]');
    if (!form) return;
    e.preventDefault();
    const q = form.querySelector('input')?.value?.trim();
    if (!q) return;
    chrome.runtime.sendMessage({ cmd: 'TABSTRIP_OPEN_URL', q });
  }

  function onClick(e) {
    // Paging chevrons
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      e.stopPropagation();
      const dir = nav.getAttribute('data-nav');
      chrome.runtime.sendMessage({ cmd: 'TABSTRIP_NAV', dir }, (res) => {
        if (res?.ok) render(res.tabs, res.activeTabId);
        navState(res);
      });
      return;
    }

    // Row 2: back/forward/reload
    const ctrl = e.target.closest('[data-action]');
    if (ctrl) {
      e.stopPropagation();
      const action = ctrl.getAttribute('data-action'); // 'back' | 'forward' | 'reload'
      if (action === 'back') {
        window.history.back();
      } else if (action === 'forward') {
        window.history.forward();
      } else if (action === 'reload') {
        location.reload();
      }
      return;
    }

    // New tab (+)
    const newBtn = e.target.closest('[data-new-tab]');
    if (newBtn) {
      e.stopPropagation();
      showWait();
      chrome.runtime.sendMessage({ cmd: 'TABSTRIP_NEW_TAB' });
      return;
    }

    // Close button (expanded hit target)
    const closeBtn = e.target.closest('[data-close-id]');
    if (closeBtn) {
      e.stopPropagation();
      const id = Number(closeBtn.getAttribute('data-close-id'));
      const closingActive = !!closeBtn.closest('.ht-tab')?.classList.contains('is-active');
      if (closingActive) showWait();
      chrome.runtime.sendMessage({ cmd: 'TABSTRIP_CLOSE', tabId: id }, () => {
        // optimistically remove item, then re-query to sync
        closeBtn.closest('.ht-tab')?.remove();
        update();
      });
      return;
    }

    // Tab activation
    const tabBtn = e.target.closest('[data-tab-id]');
    if (tabBtn) {
      e.stopPropagation();
      const id = Number(tabBtn.getAttribute('data-tab-id'));
      const winId = Number(tabBtn.getAttribute('data-window-id'));
      if (!tabBtn.classList.contains('is-active')) showWait();
      chrome.runtime.sendMessage({ cmd: 'TABSTRIP_ACTIVATE', tabId: id, windowId: winId });
    }
  }

  function tabItemTemplate(tab, isActive) {
    const btn = document.createElement('button');
    btn.className = `ht-tab${isActive ? ' is-active' : ''}`;
    btn.type = 'button';
    btn.setAttribute('data-tab-id', tab.id);
    btn.setAttribute('data-window-id', tab.windowId);
    btn.title = tab.title;

    // invisible close hit target (right 36px of the tab)
    const closeHit = document.createElement('span');
    closeHit.className = 'ht-close-hit';
    closeHit.setAttribute('data-close-id', tab.id);
    closeHit.setAttribute('role', 'button');
    closeHit.setAttribute('aria-hidden', 'true');

    const ico = document.createElement('img');
    ico.className = 'ht-favicon';
    if (tab.favIconUrl) {
      ico.src = tab.favIconUrl;
      ico.alt = '';
      ico.referrerPolicy = 'no-referrer';
    } else {
      ico.alt = '';
      ico.style.visibility = 'hidden';
    }

    const text = document.createElement('span');
    text.className = 'ht-title';
    text.textContent = tab.title || 'Untitled';

    const close = document.createElement('span');
    close.className = 'ht-close';
    close.textContent = '×';

    btn.appendChild(ico);
    btn.appendChild(text);
    btn.appendChild(closeHit);
    btn.appendChild(close);
    return btn;
  }

  function render(tabs, activeTabId) {
    list.replaceChildren();

    // Chevrons sit outside the tabs row; ensure they exist
    ensureChevrons();

    tabs.forEach(t => {
      list.appendChild(tabItemTemplate(t, t.id === activeTabId));
    });

    // '+' new tab button at the end (fixed width)
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'ht-tab ht-plus';
    plus.setAttribute('data-new-tab', '1');
    plus.setAttribute('aria-label', 'Open new tab');
    plus.appendChild(icons.plus());
    list.appendChild(plus);
  }

  function ensureChevrons() {
    if (!container) return;
    let prev = container.querySelector('.ht-prev');
    if (!prev) {
      prev = document.createElement('button');
      prev.className = 'ht-nav ht-prev';
      prev.setAttribute('data-nav', 'prev');
      prev.setAttribute('aria-label', 'Previous tabs');
      prev.appendChild(icons.chevronL());
      container.querySelector('.ht-tabstrip-inner')?.append(prev);
    }
    let next = container.querySelector('.ht-next');
    if (!next) {
      next = document.createElement('button');
      next.className = 'ht-nav ht-next';
      next.setAttribute('data-nav', 'next');
      next.setAttribute('aria-label', 'Next tabs');
      next.appendChild(icons.chevronR());
      container.querySelector('.ht-tabstrip-inner')?.append(next);
    }
  }

  function update() {
    chrome.runtime.sendMessage({ cmd: 'TABSTRIP_QUERY' }, (res) => {
      if (!res?.ok) return;
      render(res.tabs, res.activeTabId);
      navState(res);
    });
  }

  function navState(res) {
    const prev = container.querySelector('.ht-prev');
    const next = container.querySelector('.ht-next');
    prev?.classList.toggle('is-disabled', !res?.canPagePrev);
    next?.classList.toggle('is-disabled', !res?.canPageNext);
  }

  function show(animation = true) {
    ensureUI();
    clearTimeout(hideTimer);
    update();
    if (animation) {
      container.classList.remove('ht-hidden');
      container.classList.remove('is-visible');
      void container.offsetWidth;
      container.classList.add('is-visible');
    } else {
      container.classList.add('is-visible');
      container.classList.remove('ht-hidden');
    }
  }

  function hide(delay = HIDE_DELAY_DEFAULT, transitionTime = TRANSITION_DELAY_DEFAULT) {
    scheduleHide(delay, transitionTime);
  }

  function resetHideTimer(delay = HIDE_DELAY_DEFAULT) {
    if (!container) return;
    scheduleHide(delay, TRANSITION_DELAY_DEFAULT);
  }

  function scheduleHide(delay, transitionTime) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!container) return;
      state.tabstrip = "closing";
      container.classList.remove('is-visible');
      // let the transition play; then make it inert
      setTimeout(() => {
        if (state.tabstrip !== "reopen") {
          container?.querySelector('.ht-omnibox input')?.blur();
          container?.classList.add('ht-hidden');
          state.tabstrip = null;
        } else {
          state.tabstrip = "open";
        }
      }, transitionTime);
    }, delay);
  }

  function destroy() {
    hide(0, 0);
    clearTimeout(hideTimer);
    container?.remove();
    container = null;
    list = null;
    host?.remove();
    shadow = null;
    host = null;
  }

  function onOmniboxFocus() {
    window.HTKeyboard?.show?.();
  }

  // Expose controls
  window.HTTabstrip = { show, hide, destroy, resetHideTimer };
})();
