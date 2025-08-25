// src/content/scroll.js

export function startScroll(direction) {
  const { speedUp, speedDown, intervalMs } = state.config.scrolling;
  const speed = direction === 'top' ? speedUp : -speedDown;
  state.scrollInterval = setInterval(() => {
    window.scrollBy(0, speed);
  }, intervalMs);
}

export function stopScroll() {
  if (state.scrollInterval) {
    clearInterval(state.scrollInterval);
    state.scrollInterval = null;
  }
  if (state.boundaryTimer) {
    clearTimeout(state.boundaryTimer);
    state.boundaryTimer = null;
  }
  state.lastBoundary = null;
}

export function controlScroll(cursorSize) {
  const { thresholdMs } = state.config.scrolling;
  const atBottom = state.cursorY <= 0;
  const atTop = state.cursorY >= window.innerHeight - cursorSize;
  const boundary = atTop ? 'top' : atBottom ? 'bottom' : null;

  if (boundary && (state.lastBoundary !== boundary)) {
    // just entered a new boundary
    state.lastBoundary = boundary;
    // start dwell timer
    state.boundaryTimer = setTimeout(() => {
      startScroll(boundary);
    }, thresholdMs);
  } else if (state.lastBoundary && !boundary) {
    // left the boundary: stop everything
    stopScroll();
  }
}
