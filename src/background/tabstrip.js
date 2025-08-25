// src/background/tabstrip.js

import { ensureContent } from "./inject";

const TAB_WINDOW = 9;

function storageKeyForStart(windowId) {
  return `tabstripStart:${windowId}`;
}

async function getFilteredCurrentWindowTabs() {
  const all = await chrome.tabs.query({ currentWindow: true });
  return all.filter(t => /^https?:|^file:/.test(t.url || '')); // skip chrome://, chrome-extension://, devtools://
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

const _keys = new Set(); // tracks keys we’ve set

export function keysToClear() { return [..._keys]; }

export async function clearKeys() {
  const arr = [..._keys];
  if (arr.length) await chrome.storage.local.remove(arr);
  _keys.clear();
}

async function slideTabWindowRight(created) {
  // Slide window to include the new rightmost tab
  const filtered = await getFilteredCurrentWindowTabs();
  const key = storageKeyForStart(created.windowId);
  const maxStart = Math.max(0, filtered.length - TAB_WINDOW + 1);
  await chrome.storage.local.set({ [key]: maxStart });
  _keys.add(key);
}

export async function createNewTab() {
  const created = await chrome.tabs.create({ url: 'https://www.google.com', active: true });
  await slideTabWindowRight(created);
  return created;
}

export async function handleTABSTRIP_QUERY() {
  const filtered = await getFilteredCurrentWindowTabs();
  const activeIdx = filtered.findIndex(t => t.active);

  const windowId = filtered[activeIdx]?.windowId ?? (await chrome.windows.getCurrent())?.id;
  const key = storageKeyForStart(windowId);
  const maxStart = Math.max(0, filtered.length - TAB_WINDOW);

  // read persisted start; if missing, center active on first open
  const got = await chrome.storage.local.get(key);
  let start = typeof got[key] === 'number'
    ? clamp(got[key], 0, maxStart)
    : clamp(activeIdx - Math.floor(TAB_WINDOW / 2), 0, maxStart);

  if (!(key in got)) {
    await chrome.storage.local.set({ [key]: start });
    _keys.add(key);
  }

  let end = Math.min(filtered.length, start + TAB_WINDOW);
  if (end - start < TAB_WINDOW) start = Math.max(0, end - TAB_WINDOW);

  const windowed = filtered.slice(start, end).map(t => ({
    id: t.id,
    windowId: t.windowId,
    title: t.title || 'Untitled',
    favIconUrl: t.favIconUrl || '',
    index: t.index,
    active: t.active,
  }));

  return {
    ok: true,
    tabs: windowed,
    activeTabId: filtered[activeIdx]?.id ?? null,
    canPagePrev: start > 0,
    canPageNext: end < filtered.length,
  };
}

export async function handleTABSTRIP_NAV({ dir }) {
  const filtered = await getFilteredCurrentWindowTabs();
  const activeIdx = filtered.findIndex(t => t.active);
  const windowId = filtered[activeIdx]?.windowId ?? (await chrome.windows.getCurrent())?.id;
  const key = storageKeyForStart(windowId);
  const maxStart = Math.max(0, filtered.length - TAB_WINDOW);
  const got = await chrome.storage.local.get(key);
  let start = clamp((typeof got[key] === 'number' ? got[key] : 0) + (dir === 'next' ? TAB_WINDOW : -TAB_WINDOW), 0, maxStart);

  await chrome.storage.local.set({ [key]: start });
  _keys.add(key);

  let end = Math.min(filtered.length, start + TAB_WINDOW);
  if (end - start < TAB_WINDOW) start = Math.max(0, end - TAB_WINDOW);

  const windowed = filtered.slice(start, end).map(t => ({
    id: t.id, windowId: t.windowId, title: t.title || 'Untitled',
    favIconUrl: t.favIconUrl || '', index: t.index, active: t.active
  }));

  return {
    ok: true,
    tabs: windowed,
    activeTabId: filtered[activeIdx]?.id ?? null,
    canPagePrev: start > 0,
    canPageNext: end < filtered.length,
  };
}

export async function handleTABSTRIP_ACTIVATE({ tabId, windowId }) {
  try {
    // Bring window to front (if different), then activate the tab
    if (windowId !== undefined) {
      await chrome.windows.update(windowId, { focused: true });
    }

    const isAlreadyInjected = await ensureContent(tabId);

    if (isAlreadyInjected) {
      await chrome.storage.local.set({ tabstripForceOpen: 'reopen' });
      await chrome.tabs.sendMessage(tabId, { cmd: 'GLOBAL_CLICK_SUPPRESS' });
    } else {
      await chrome.storage.local.set({ tabstripForceOpen: 'initial' });
    }

    await chrome.tabs.update(tabId, { active: true }); // switches tabs

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}

export async function handleTABSTRIP_NEW_TAB() {
  try {
    const created = await createNewTab();
    return { ok: true, tabId: created.id };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}

export async function handleTABSTRIP_CLOSE({ tabId }) {
  try {
    // If closing the active tab, proactively suppress clicks in the replacement
    const filtered = await getFilteredCurrentWindowTabs();
    const idx = filtered.findIndex(t => t.id === tabId);
    if (idx !== -1 && filtered[idx].active) {
      const replacement = filtered[idx + 1] || filtered[idx - 1];
      if (replacement) {
        const injected = await ensureContent(replacement.id);
        if (injected) {
          await chrome.tabs.sendMessage(replacement.id, { cmd: 'GLOBAL_CLICK_SUPPRESS' });
          await chrome.storage.local.set({ tabstripForceOpen: 'reopen' });
        } else {
          await chrome.storage.local.set({ tabstripForceOpen: 'initial' });
        }
      }
    }
    await chrome.tabs.remove(tabId); // close after suppression
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}

export async function handleTABSTRIP_OPEN_URL(msg) {
  try {
    const q = (msg.q || '').trim();
    if (!q) return { ok: false, error: 'Empty query' };

    // URL heuristics → otherwise Google search
    const looksURL = /^(https?:|file:)/i.test(q) || (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(q) && !/\s/.test(q));
    const finalUrl = looksURL ? (/^(https?:|file:)/i.test(q) ? q : `https://${q}`)
      : `https://www.google.com/search?q=${encodeURIComponent(q)}`;

    const created = await chrome.tabs.create({ url: finalUrl, active: true });

    // Slide to show the brand new tab at the far right
    await slideTabWindowRight(created);

    return { ok: true, tabId: created.id };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}
