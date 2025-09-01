// src/content/click-score.js

export default function getClickScore(blends) {
  const clickAction = state.config.actions.click;
  if (clickAction === "smile") {

    const smileL = blends[44]?.score ?? 0; // 44 = mouthSmileLeft 
    const smileR = blends[45]?.score ?? 0; // 45 = mouthSmileRight

    return (smileL + smileR) * 0.5;

  } else if (clickAction === "smileLeft") {

    const smileL = blends[44]?.score ?? 0; // 44 = mouthSmileLeft 
    const smileR = blends[45]?.score ?? 0; // 45 = mouthSmileRight

    return (smileL >= 0.6 && smileR < 0.6) ? 1.0 : 0.0;

  } else if (clickAction === "smileRight") {

    const smileL = blends[44]?.score ?? 0; // 44 = mouthSmileLeft 
    const smileR = blends[45]?.score ?? 0; // 45 = mouthSmileRight

    return (smileR >= 0.6 && smileL < 0.6) ? 1.0 : 0.0;

  } else if (clickAction === "browUp") {

    const browUpL = blends[4]?.score ?? 0; // 4 = browOuterUpLeft 
    const browUpR = blends[5]?.score ?? 0; // 5 = browOuterUpRight

    return (browUpL + browUpR) * 0.5;

  } else if (clickAction === "browDown") {

    const browDownL = blends[1]?.score ?? 0; // 1 = browDownLeft
    const browDownR = blends[2]?.score ?? 0; // 2 = browDownRight

    return (browDownL + browDownR) * 0.5;

  } else if (clickAction === "jawOpen") {

    const jawOpen = blends[25]?.score ?? 0; // 25 = jawOpen

    return jawOpen;

  } else if (clickAction === "showTeeth") {

    const mouthUpperUpLeft = blends[48]?.score ?? 0; // 48 = mouthUpperUpLeft 
    const mouthUpperUpRight = blends[49]?.score ?? 0; // 49 = mouthUpperUpRight

    return (mouthUpperUpLeft + mouthUpperUpRight) * 0.5;

  }
  else if (clickAction === "lookLeft") {

    const eyeLookInRight = blends[14]?.score ?? 0; // 14 = eyeLookInRight
    const eyeLookOutLeft = blends[15]?.score ?? 0; // 15 = eyeLookOutLeft 

    return (eyeLookOutLeft + eyeLookInRight) * 0.5;

  } else if (clickAction === "lookRight") {

    const eyeLookInLeft = blends[13]?.score ?? 0; // 13 = eyeLookInLeft
    const eyeLookOutRight = blends[16]?.score ?? 0; // 16 = eyeLookOutRight

    return (eyeLookInLeft + eyeLookOutRight) * 0.5;

  } else if (clickAction === "lookUp") {

    const eyeLookUpLeft = blends[17]?.score ?? 0; // 17 = eyeLookUpLeft
    const eyeLookUpRight = blends[18]?.score ?? 0; // 18 = eyeLookUpRight

    return (eyeLookUpLeft + eyeLookUpRight) * 0.5;

  } else if (clickAction === "lookDown") {

    const eyeLookDownLeft = blends[11]?.score ?? 0; // 11 = eyeLookDownLeft
    const eyeLookDownRight = blends[12]?.score ?? 0; // 12 = eyeLookDownRight

    return (eyeLookDownLeft + eyeLookDownRight) * 0.5;

  } else if (clickAction === "mouthPucker") {

    const mouthPucker = blends[38]?.score ?? 0; // 38 = mouthPucker

    return mouthPucker;

  } else {
    console.warn(`Click action setting "${clickAction}" is not available.`);
    return 0;
  }
}
