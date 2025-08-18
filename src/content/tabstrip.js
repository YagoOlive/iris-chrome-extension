// src/content/tabstrip.js

(() => {
  const CONTAINER_ID = 'ht-tabstrip';
  const LIST_ID = 'ht-tabstrip-list';
  const HIDE_DELAY_DEFAULT = 2000;
  const TRANSITION_DELAY_DEFAULT = 1010;

  let container, list, hideTimer;

  function ensureUI() {
    if (document.getElementById(CONTAINER_ID)) {
      container = document.getElementById(CONTAINER_ID);
      list = document.getElementById(LIST_ID);
      return;
    }
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

    const mkCtrl = (cls, label, action, text) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ht-ctrl ${cls}`;
      b.setAttribute('data-action', action);
      b.setAttribute('aria-label', label);
      b.textContent = text;
      return b;
    };
    const backBtn = mkCtrl('ht-back', 'Go back', 'back', '←');
    const fwdBtn = mkCtrl('ht-fwd', 'Go forward', 'forward', '→');
    const refBtn = mkCtrl('ht-refresh', 'Refresh', 'reload', '⟳');

    const omni = document.createElement('form');
    omni.className = 'ht-omnibox';
    omni.setAttribute('data-omnibox', '1');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search or type a URL';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const go = document.createElement('button');
    go.type = 'submit';
    go.className = 'ht-go';
    go.setAttribute('aria-label', 'Open in new tab');
    go.textContent = '↵';

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
    document.documentElement.appendChild(container);

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
      const action = ctrl.getAttribute('data-action'); // 'back' | 'forward'| 'reload'
      chrome.runtime.sendMessage({ cmd: 'TABSTRIP_NAVIGATE', action });
      return;
    }

    // New tab (+)
    const newBtn = e.target.closest('[data-new-tab]');
    if (newBtn) {
      e.stopPropagation();
      chrome.runtime.sendMessage({ cmd: 'TABSTRIP_NEW_TAB' });
      return;
    }

    // Close button (expanded hit target)
    const closeBtn = e.target.closest('[data-close-id]');
    if (closeBtn) {
      e.stopPropagation();
      const id = Number(closeBtn.getAttribute('data-close-id'));
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

    // invisible close hit target (right 30% of the tab)
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
    plus.textContent = '+';
    list.appendChild(plus);
  }

  function ensureChevrons() {
    if (!container) return;
    let prev = container.querySelector('.ht-prev');
    let next = container.querySelector('.ht-next');
    if (!prev) {
      prev = document.createElement('button');
      prev.className = 'ht-nav ht-prev';
      prev.setAttribute('data-nav', 'prev');
      prev.setAttribute('aria-label', 'Previous tabs');
      prev.textContent = '‹';
      container.querySelector('.ht-tabstrip-inner')?.append(prev);
    }
    if (!next) {
      next = document.createElement('button');
      next.className = 'ht-nav ht-next';
      next.setAttribute('data-nav', 'next');
      next.setAttribute('aria-label', 'Next tabs');
      next.textContent = '›';
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
    container.querySelector('.ht-omnibox input')?.focus();
  }

  function hide(delay = HIDE_DELAY_DEFAULT, transitionTime = TRANSITION_DELAY_DEFAULT) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!container) return;
      state.tabstrip = "closing";
      container.classList.remove('is-visible');
      // let the transition play; then make it inert
      setTimeout(() => {
        if (state.tabstrip !== "reopen") {
          container.querySelector('.ht-omnibox input')?.blur();
          container?.classList.add('ht-hidden');
          state.tabstrip = null;
        } else {
          state.tabstrip = "open";
        }
      }, transitionTime);
    }, delay);
  }

  function destroy() {
    clearTimeout(hideTimer);
    container?.remove();
    container = null;
    list = null;
  }

  // Expose controls
  window.HTTabstrip = { show, hide, destroy };
})();
