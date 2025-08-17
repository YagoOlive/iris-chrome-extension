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

    const prev = document.createElement('button');
    prev.className = 'ht-nav ht-prev';
    prev.setAttribute('data-nav', 'prev');
    prev.setAttribute('aria-label', 'Previous tabs');
    prev.textContent = '‹';

    const next = document.createElement('button');
    next.className = 'ht-nav ht-next';
    next.setAttribute('data-nav', 'next');
    next.setAttribute('aria-label', 'Next tabs');
    next.textContent = '›';

    const title = document.createElement('div');
    title.className = 'ht-tabstrip-title';
    title.textContent = 'Tabs';

    list = document.createElement('div');
    list.id = LIST_ID;
    list.className = 'ht-tabs';

    inner.appendChild(title);
    inner.append(prev);
    inner.appendChild(list);
    inner.append(next);
    container.appendChild(inner);
    document.documentElement.appendChild(container);

    container.addEventListener('click', onClick, true);
  }

  function onClick(e) {
    // Paging
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

    // New tab
    const newBtn = e.target.closest('[data-new-tab]');
    if (newBtn) {
      e.stopPropagation();
      chrome.runtime.sendMessage({ cmd: 'TABSTRIP_NEW_TAB' });
      return;
    }

    // Close button
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
    close.setAttribute('data-close-id', tab.id);
    close.setAttribute('role', 'button');
    close.setAttribute('aria-label', 'Close tab');
    close.textContent = '×';

    btn.appendChild(ico);
    btn.appendChild(text);
    btn.appendChild(close);
    return btn;
  }

  function render(tabs, activeTabId) {
    list.replaceChildren();
    tabs.forEach(t => {
      list.appendChild(tabItemTemplate(t, t.id === activeTabId));
    });
    // add a '+' new tab button at the end
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'ht-tab ht-plus';
    plus.setAttribute('data-new-tab', '1');
    plus.setAttribute('aria-label', 'Open new tab');
    plus.textContent = '+';
    list.appendChild(plus);
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
      container.classList.remove('is-visible'); // ensure starting state
      // force a reflow so the transition triggers
      void container.offsetWidth; // ← magic: reads layout, flushes styles
      container.classList.add('is-visible');
    } else {
      container.classList.add('is-visible');
      container.classList.remove('ht-hidden');
    }
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

  // Expose a tiny control surface for tracker.js
  window.HTTabstrip = { show, hide, destroy };
})();
