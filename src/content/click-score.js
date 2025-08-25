// src/content/click-score.js

export default function getClickScore(blends) {
  const clickAction = state.config.actions.click;
  if (clickAction === "smile") {

    const smileL = blends[44]?.score ?? 0; // 44 = mouthSmileLeft 
    const smileR = blends[45]?.score ?? 0; // 45 = mouthSmileRight

    return (smileL + smileR) / 2;

  } else if (clickAction === "browUp") {

    const browUpL = blends[4]?.score ?? 0; // 4 = browOuterUpLeft 
    const browUpR = blends[5]?.score ?? 0; // 5 = browOuterUpRight

    return (browUpL + browUpR) / 2;

  } else if (clickAction === "jawOpen") {

    const jawOpen = blends[25]?.score ?? 0; // 25 = jawOpen

    return jawOpen;

  } else {
    console.warn(`Click action setting "${clickAction}" is not available.`);
    return 0;
  }
}
