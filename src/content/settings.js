// Click threshold value for each click action
const clickThresholdAction = {
  smile: 0.8,
  browUp: 0.8,
  jawOpen: 0.6,
}

export function initSettings(items) {
  if (typeof items.exponentialSmoothingFactor === 'number') {
    window.state.config.exponentialSmoothingFactor = items.exponentialSmoothingFactor;
    console.log('Loaded smoothing factor:', items.exponentialSmoothingFactor);
  }
  if (typeof items.clickAction === 'string') {
    window.state.config.actions.click = items.clickAction;
    console.log('Loaded click action:', items.clickAction);
    window.state.config.actions.clickThreshold = clickThresholdAction[items.clickAction] || 1.0;
    console.log('Click action threshold:', state.config.actions.clickThreshold);
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
      window.state.config.exponentialSmoothingFactor = msg.exponentialSmoothingFactor;
      console.log('Smoothing factor set to: ', msg.exponentialSmoothingFactor);
    } else if (setting === 'clickAction' && typeof msg.clickAction === 'string') {
      window.state.config.actions.click = msg.clickAction;
      console.log('Click action set to:', msg.clickAction);
      window.state.config.actions.clickThreshold = clickThresholdAction[msg.clickAction] || 1.0;
      console.log('Click action threshold set to:', state.config.actions.clickThreshold);
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
