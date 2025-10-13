// src/content/click-score.js

export function getGestureScore(action, blends) {
  if (!action) return 0;

  if (action === "smile") {

    const smileL = blends[44]?.score ?? 0; // 44 = mouthSmileLeft 
    const smileR = blends[45]?.score ?? 0; // 45 = mouthSmileRight

    return (smileL + smileR) * 0.5;

  } else if (action === "smileLeft") {

    const smileL = blends[44]?.score ?? 0; // 44 = mouthSmileLeft 
    const smileR = blends[45]?.score ?? 0; // 45 = mouthSmileRight

    return (smileL >= 0.6 && smileR < 0.6) ? 1.0 : 0.0;

  } else if (action === "smileRight") {

    const smileL = blends[44]?.score ?? 0; // 44 = mouthSmileLeft 
    const smileR = blends[45]?.score ?? 0; // 45 = mouthSmileRight

    return (smileR >= 0.6 && smileL < 0.6) ? 1.0 : 0.0;

  } else if (action === "browUp") {

    const browUpL = blends[4]?.score ?? 0; // 4 = browOuterUpLeft 
    const browUpR = blends[5]?.score ?? 0; // 5 = browOuterUpRight

    return (browUpL + browUpR) * 0.5;

  } else if (action === "browDown") {

    const browDownL = blends[1]?.score ?? 0; // 1 = browDownLeft
    const browDownR = blends[2]?.score ?? 0; // 2 = browDownRight

    return (browDownL + browDownR) * 0.5;

  } else if (action === "jawOpen") {

    const jawOpen = blends[25]?.score ?? 0; // 25 = jawOpen

    return jawOpen;

  } else if (action === "showTeeth") {

    const mouthUpperUpLeft = blends[48]?.score ?? 0; // 48 = mouthUpperUpLeft 
    const mouthUpperUpRight = blends[49]?.score ?? 0; // 49 = mouthUpperUpRight

    return (mouthUpperUpLeft + mouthUpperUpRight) * 0.5;

  }
  else if (action === "lookLeft") {

    const eyeLookInRight = blends[14]?.score ?? 0; // 14 = eyeLookInRight
    const eyeLookOutLeft = blends[15]?.score ?? 0; // 15 = eyeLookOutLeft 

    return (eyeLookOutLeft + eyeLookInRight) * 0.5;

  } else if (action === "lookRight") {

    const eyeLookInLeft = blends[13]?.score ?? 0; // 13 = eyeLookInLeft
    const eyeLookOutRight = blends[16]?.score ?? 0; // 16 = eyeLookOutRight

    return (eyeLookInLeft + eyeLookOutRight) * 0.5;

  } else if (action === "lookUp") {

    const eyeLookUpLeft = blends[17]?.score ?? 0; // 17 = eyeLookUpLeft
    const eyeLookUpRight = blends[18]?.score ?? 0; // 18 = eyeLookUpRight

    return (eyeLookUpLeft + eyeLookUpRight) * 0.5;

  } else if (action === "lookDown") {

    const eyeLookDownLeft = blends[11]?.score ?? 0; // 11 = eyeLookDownLeft
    const eyeLookDownRight = blends[12]?.score ?? 0; // 12 = eyeLookDownRight

    return (eyeLookDownLeft + eyeLookDownRight) * 0.5;

  } else if (action === "mouthPucker") {

    const mouthPucker = blends[38]?.score ?? 0; // 38 = mouthPucker

    return mouthPucker;

  } else {
    console.warn(`Gesture setting "${action}" is not available.`);
    return 0;
  }
}

export default function getClickScore(blends) {
  return getGestureScore(state.config.actions.click, blends);
}
