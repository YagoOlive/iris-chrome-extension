function initializeCursors() {
  // Remove existing cursors
  ["head-cursor-clipped", "head-cursor-raw"].forEach(id => {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
  });

  // Reset cursor state
  state.lastHeadX = null;
  state.lastHeadY = null;
  state.cursorX = null;
  state.cursorY = null;
  state.rawCursorX = null;
  state.rawCursorY = null;

  // Create cursors with consistent styles
  const cursors = [
    { id: "head-cursor-clipped", color: "red", zIndex: "1000" },
    { id: "head-cursor-raw", color: "blue", opacity: "0.5", zIndex: "999" }
  ];

  cursors.forEach(({ id, color, opacity = "1", zIndex }) => {
    const cursor = document.createElement("div");
    cursor.id = id;
    cursor.style.position = "fixed";
    cursor.style.width = "20px";
    cursor.style.height = "20px";
    cursor.style.borderRadius = "50%";
    cursor.style.backgroundColor = color;
    cursor.style.opacity = opacity;
    cursor.style.zIndex = zIndex;
    cursor.style.transform = "translate(-50%, -50%)";
    cursor.style.pointerEvents = "none";
    document.body.appendChild(cursor);
  });

  // Initialize positions at center
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  cursors.forEach(({ id }) => {
    const cursor = document.getElementById(id);
    cursor.style.left = `${centerX}px`;
    cursor.style.top = `${centerY}px`;
  });
}