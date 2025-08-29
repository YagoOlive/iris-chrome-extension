// src/content/cursor.js

(() => {
  let inner = null;
  let notch = null;

  let waitRing = null;
  let waitTrack = null;

  function createWaitRing() {
    if (waitRing) return;

    waitRing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    waitRing.setAttribute("class", "wait-ring");
    waitRing.setAttribute("viewBox", "0 0 18 18");
    waitRing.style.overflow = 'visible';

    waitTrack = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    waitTrack.setAttribute("class", "wait-track");
    waitTrack.setAttribute("cx", "9");
    waitTrack.setAttribute("cy", "9");
    waitTrack.setAttribute("r", "4");

    const spinningArc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    spinningArc.setAttribute("class", "spinner");
    spinningArc.setAttribute("cx", "9");
    spinningArc.setAttribute("cy", "9");
    spinningArc.setAttribute("r", "4");

    waitRing.appendChild(waitTrack);
    waitRing.appendChild(spinningArc);
    window.state.sprite.appendChild(waitRing);
  }

  function createSprite() {
    if (state.sprite) return;

    const sprite = document.createElement('div');
    sprite.id = 'ht-cursor';

    // Make it a popover so it lives in the top layer.
    if ('showPopover' in sprite) {
      sprite.setAttribute('popover', 'manual');
    }

    document.documentElement.appendChild(sprite);
    state.sprite = sprite;

    inner = document.createElement('div');
    notch = document.createElement('div');
    inner.classList.add('cursor-inner');
    notch.classList.add('cursor-notch');
    sprite.appendChild(inner);
    sprite.appendChild(notch);

    window.HTDwellClick?.createDwellRing();
    createWaitRing();

    // Center initially via transform (no layout/overflow conflicts)
    const x = Math.round(window.innerWidth / 2);
    const y = Math.round(window.innerHeight / 2);
    sprite.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    // Enter the top layer
    try { sprite.showPopover?.(); } catch { /* */ }

    // Keep cursor above any newly opened top-layer element
    const bumpToTopLayer = () => {
      if (state.sprite?.matches?.(':popover-open')) {
        try { state.sprite.hidePopover(); state.sprite.showPopover(); } catch { /* */ }
      }
    };
    const mo = new MutationObserver(() => {
      if (document.querySelector('dialog[open], [popover]:popover-open')) bumpToTopLayer();
    });
    mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open', 'popover'] });

  }

  function destroySprite() {
    notch?.remove();
    inner?.remove();
    window.state.sprite?.remove();
    window.state.sprite = null;
    inner = null;
    notch = null;
  }

  function showWait() {
    window.state.sprite?.classList.add('is-waiting');
    window.state.loading = true;
  }

  function hideWait() {
    window.state.sprite?.classList.remove('is-waiting');
    window.state.loading = false;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hideWait();
  });

  window.HTCursor = { createSprite, destroySprite, showWait, hideWait };
})();
