// src/content/settings.js

const gestureThresholds = {
  smile: 0.8,
  smileLeft: 0.8,
  smileRight: 0.8,
  browUp: 0.8,
  browDown: 0.6,
  jawOpen: 0.6,
  showTeeth: 0.8,
  lookLeft: 0.8,
  lookRight: 0.8,
  lookUp: 0.6,
  lookDown: 0.6,
  mouthPucker: 0.8,
};

const exponentialSmoothingAdjustment = 2;

export function initSettings(items) {
  if (typeof items.exponentialSmoothingFactor === 'number') {
    window.state.config.exponentialSmoothingFactor = items.exponentialSmoothingFactor ** exponentialSmoothingAdjustment;
  }
  if (typeof items.cursorSprite === 'string') {
    window.state.config.cursorSprite = items.cursorSprite;
  }
  if (typeof items.clickAction === 'string') {
    window.state.config.actions.click = items.clickAction;
    window.state.config.actions.clickThreshold = gestureThresholds[items.clickAction] || 1.0;
  }
  if (typeof items.doubleClickAction === 'string') {
    window.state.config.actions.doubleClick = items.doubleClickAction;
    window.state.config.actions.doubleClickThreshold = gestureThresholds[items.doubleClickAction] || 1.0;
  }
  if (typeof items.rightClickAction === 'string') {
    window.state.config.actions.rightClick = items.rightClickAction;
    window.state.config.actions.rightClickThreshold = gestureThresholds[items.rightClickAction] || 0.8;
  }

  window.HTCursor?.setSpriteVariant?.(window.state.config.cursorSprite || 'arrow');

  window.state.config.clickAssist = !!items.clickAssist;
  window.state.config.dwellClick  = !!items.dwellClick;

  if (typeof items.clickTimeout === 'number') window.state.config.clickAssistTimeout = items.clickTimeout;
  if (typeof items.clickRadius  === 'number') window.state.config.clickAssistRadius  = items.clickRadius;
  if (typeof items.dwellTime    === 'number') window.state.config.dwellTime           = items.dwellTime;
  if (typeof items.dwellArea    === 'number') window.state.config.dwellArea           = items.dwellArea;
}

export function updateSettings(msg) {
  for (const setting in msg) {
    if (setting === 'cmd') continue;

    if (setting === 'exponentialSmoothingFactor' && typeof msg.exponentialSmoothingFactor === 'number') {
      window.state.config.exponentialSmoothingFactor = msg.exponentialSmoothingFactor ** exponentialSmoothingAdjustment;
    } else if (setting === 'cursorSprite' && typeof msg.cursorSprite === 'string') {
      window.state.config.cursorSprite = msg.cursorSprite;
      window.HTCursor?.setSpriteVariant?.(msg.cursorSprite);
    } else if (setting === 'clickAction' && typeof msg.clickAction === 'string') {
      window.state.config.actions.click = msg.clickAction;
      window.state.config.actions.clickThreshold = gestureThresholds[msg.clickAction] || 1.0;
    } else if (setting === 'doubleClickAction' && typeof msg.doubleClickAction === 'string') {
      window.state.config.actions.doubleClick = msg.doubleClickAction;
      window.state.config.actions.doubleClickThreshold = gestureThresholds[msg.doubleClickAction] || 1.0;
    } else if (setting === 'rightClickAction' && typeof msg.rightClickAction === 'string') {
      window.state.config.actions.rightClick = msg.rightClickAction;
      window.state.config.actions.rightClickThreshold = gestureThresholds[msg.rightClickAction] || 0.8;
    } else if (setting === 'clickAssist') {
      window.state.config.clickAssist = !!msg.clickAssist;
    } else if (setting === 'clickTimeout' && typeof msg.clickTimeout === 'number') {
      window.state.config.clickAssistTimeout = msg.clickTimeout;
    } else if (setting === 'clickRadius' && typeof msg.clickRadius === 'number') {
      window.state.config.clickAssistRadius = msg.clickRadius;
    } else if (setting === 'dwellClick') {
      window.state.config.dwellClick = !!msg.dwellClick;
    } else if (setting === 'dwellTime' && typeof msg.dwellTime === 'number') {
      window.state.config.dwellTime = msg.dwellTime;
    } else if (setting === 'dwellArea' && typeof msg.dwellArea === 'number') {
      window.state.config.dwellArea = msg.dwellArea;
    }
  }
}
