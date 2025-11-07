// src/content/settings.js

// Click threshold value for each click action
const gestureThresholds = {
  smile: 0.8,
  browUp: 0.8,
  browDown: 0.6,
  jawOpen: 0.6,
  showTeeth: 0.8,
  lookLeft: 0.8,
  lookRight: 0.8,
  lookUp: 0.6,
  lookDown: 0.6,
  mouthPucker: 0.8,
}

const exponentialSmoothingAdjustment = 2;

export function initSettings(items) {
  if (typeof items.exponentialSmoothingFactor === 'number') {
    window.state.config.exponentialSmoothingFactor = items.exponentialSmoothingFactor ** exponentialSmoothingAdjustment;
    console.log('Loaded smoothing factor:', items.exponentialSmoothingFactor);
  }
  if (typeof items.clickAction === 'string') {
    window.state.config.actions.click = items.clickAction;
    console.log('Loaded click action:', items.clickAction);
    window.state.config.actions.clickThreshold = gestureThresholds[items.clickAction] || 1.0;
    console.log('Click action threshold:', state.config.actions.clickThreshold);
  }
  if (typeof items.doubleClickAction === 'string') {
    window.state.config.actions.doubleClick = items.doubleClickAction;
    window.state.config.actions.doubleClickThreshold = gestureThresholds[items.doubleClickAction] || 1.0;
    console.log('Loaded double-click action:', items.doubleClickAction);
  }

  if (typeof items.keyboardEnabled === 'boolean') {
    window.state.config.keyboard.enabled = items.keyboardEnabled;
    console.log(`On-screen keyboard: ${items.keyboardEnabled ? 'ON' : 'OFF'}`);
    if (!items.keyboardEnabled) {
      window.HTKeyboard?.hide?.();
    }
  }
  if (typeof items.keyboardAction === 'string') {
    window.state.config.keyboard.action = items.keyboardAction;
    window.state.config.keyboard.actionThreshold = gestureThresholds[items.keyboardAction] || 1.0;
    console.log('Keyboard gesture set to:', items.keyboardAction);
  }

  window.state.config.clickAssist = items.clickAssist ? true : false;
  console.log(`Click Assist: ${items.clickAssist ? 'ON' : 'OFF'}`);
  window.state.config.dwellClick = items.dwellClick ? true : false;
  console.log(`Dwell Click: ${items.dwellClick ? 'ON' : 'OFF'}`);

  if (typeof items.clickTimeout === 'number') {
    window.state.config.clickAssistTimeout = items.clickTimeout;
    console.log(`Click Assist Timeout: ${items.clickTimeout}ms`);
  }
  if (typeof items.clickRadius === 'number') {
    window.state.config.clickAssistRadius = items.clickRadius;
    console.log(`Click Assist Radius: ${items.clickRadius}px`);
  }
  if (typeof items.dwellTime === 'number') {
    window.state.config.dwellTime = items.dwellTime;
    console.log(`Dwell Time: ${items.dwellTime}ms`);
  }
  if (typeof items.dwellArea === 'number') {
    window.state.config.dwellArea = items.dwellArea;
    console.log(`Dwell Area: ${items.dwellArea}px`);
  }
}

export function updateSettings(msg) {
  for (const setting in msg) {
    if (setting === 'cmd') {
      continue;
    } else if (setting === 'exponentialSmoothingFactor' && typeof msg.exponentialSmoothingFactor === 'number') {
      window.state.config.exponentialSmoothingFactor = msg.exponentialSmoothingFactor ** exponentialSmoothingAdjustment;
      console.log('Smoothing factor set to: ', msg.exponentialSmoothingFactor);
    } else if (setting === 'clickAction' && typeof msg.clickAction === 'string') {
      window.state.config.actions.click = msg.clickAction;
      console.log('Click action set to:', msg.clickAction);
      window.state.config.actions.clickThreshold = gestureThresholds[msg.clickAction] || 1.0;
      console.log('Click action threshold set to:', state.config.actions.clickThreshold);
    } else if (setting === 'doubleClickAction' && typeof msg.doubleClickAction === 'string') {
      window.state.config.actions.doubleClick = msg.doubleClickAction;
      window.state.config.actions.doubleClickThreshold = gestureThresholds[msg.doubleClickAction] || 1.0;
      console.log('Double-click action set to:', msg.doubleClickAction);
    } else if (setting === 'keyboardEnabled') {
      window.state.config.keyboard.enabled = msg.keyboardEnabled ? true : false;
      console.log(`On-screen keyboard set to: ${msg.keyboardEnabled ? 'ON' : 'OFF'}`);
      if (!msg.keyboardEnabled) {
        window.HTKeyboard?.hide?.();
      }
    } else if (setting === 'keyboardAction' && typeof msg.keyboardAction === 'string') {
      window.state.config.keyboard.action = msg.keyboardAction;
      window.state.config.keyboard.actionThreshold = gestureThresholds[msg.keyboardAction] || 1.0;
      console.log('Keyboard gesture set to:', msg.keyboardAction);
    } else if (setting === 'clickAssist') {
      window.state.config.clickAssist = msg.clickAssist ? true : false;
      console.log(`Click Assist set to: ${msg.clickAssist ? 'ON' : 'OFF'}`);
    } else if (setting === 'clickTimeout' && typeof msg.clickTimeout === 'number') {
      window.state.config.clickAssistTimeout = msg.clickTimeout;
      console.log(`Click Assist Timeout set to: ${msg.clickTimeout}ms`);
    } else if (setting === 'clickRadius' && typeof msg.clickRadius === 'number') {
      window.state.config.clickAssistRadius = msg.clickRadius;
      console.log(`Click Assist Radius set to: ${msg.clickRadius}px`);
    } else if (setting === 'dwellClick') {
      window.state.config.dwellClick = msg.dwellClick ? true : false;
      console.log(`Dwell Click set to: ${msg.dwellClick ? 'ON' : 'OFF'}`);
    } else if (setting === 'dwellTime' && typeof msg.dwellTime === 'number') {
      window.state.config.dwellTime = msg.dwellTime;
      console.log(`Dwell Time set to: ${msg.dwellTime}ms`);
    } else if (setting === 'dwellArea' && typeof msg.dwellArea === 'number') {
      window.state.config.dwellArea = msg.dwellArea;
      console.log(`Dwell Area set to: ${msg.dwellArea}px`);
    }
  }
}
