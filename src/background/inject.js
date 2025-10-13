// src/background/inject.js

import stateScript from '../content/state.js?script';
import trackerScript from '../content/tracker.js?script';
import cursorScript from '../content/cursor.js?script';
import scrollScript from '../content/scroll.js?script';
import clickScoreScript from '../content/click-score.js?script';
import settingsScript from '../content/settings.js?script';
import tabstripScript from '../content/tabstrip.js?script';
import clickScript from '../content/click.js?script';
import dwellClickScript from '../content/dwell-click.js?script';
import hoverScript from '../content/hover.js?script';
import keyboardScript from '../content/keyboard.js?script';

const CSS_FILES = ['content/cursor.css', 'content/tabstrip.css', 'content/keyboard.css'];

const CONTENT_SCRIPTS_ORDERED = [
  stateScript,
  cursorScript,
  dwellClickScript,
  clickScript,
  hoverScript,
  keyboardScript,
  trackerScript,
  scrollScript,
  clickScoreScript,
  settingsScript,
  tabstripScript,
];

// Injects the content scripts and CSS into a specific tab
export async function injectContent(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: CSS_FILES });
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: CONTENT_SCRIPTS_ORDERED,
    });
  } catch (err) {
    console.error(`Failed to inject content into tab ${tabId}:`, err);
    return false;
  }
  return true;
}

// Ensure the script is injected only once and return true if it was already injected
export async function ensureContent(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { cmd: 'PING' });
    if (res?.ok) return true; // already injected
  } catch { /* no listener */ }
  await injectContent(tabId);
  return false;
}
