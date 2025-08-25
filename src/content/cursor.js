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
    window.state.sprite = document.createElement('div');
    inner = document.createElement('div');
    notch = document.createElement('div');
    window.state.sprite.id = 'ht-cursor';
    inner.classList.add('cursor-inner');
    notch.classList.add('cursor-notch');
    document.documentElement.appendChild(state.sprite);
    window.state.sprite.appendChild(inner);
    window.state.sprite.appendChild(notch);

    window.HTDwellClick?.createDwellRing();
    createWaitRing();

    // Round for display
    const roundedX = Math.round(window.innerWidth / 2);
    const roundedY = Math.round(window.innerHeight / 2);

    // Initialize cursor at the center of the screen
    window.state.sprite.style.left = `${roundedX}px`;
    window.state.sprite.style.top = `${roundedY}px`;
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
