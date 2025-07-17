// src/offscreen/index.js

import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

let faceLandmarker = null;
let stopRequested = false;

// --- PORT CONNECTION ---
const port = chrome.runtime.connect({ name: 'offscreen' });
port.onMessage.addListener(handleMessages);

const videoElement = document.getElementById("offscreen-video");
videoElement.playsInline = true;   // avoids full-screen on some platforms
videoElement.muted = true;    // autoplay is allowed when muted

async function handleMessages(msg) {
  switch (msg.cmd) {
    /* -------------------- START -------------------- */
    case "START_CAMERA": {
      /* 1️⃣ Load WASM + model exactly once */
      if (!faceLandmarker) {
        const vision = await FilesetResolver.forVisionTasks(
          chrome.runtime.getURL("vendor/tasks-vision/wasm")   // local WASM dir
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: chrome.runtime.getURL(
              "vendor/models/face_landmarker.task"
            ),
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          refineLandmarks: true,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      /* 2️⃣ Open camera */
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElement.srcObject = stream;
      await new Promise(r => videoElement.onloadedmetadata = r);
      await videoElement.play();        // make sure readyState === HAVE_ENOUGH_DATA
      console.log("Off-screen: camera playing…");

      stopRequested = false;
      const intervalId = setInterval(() => {
        if (stopRequested) {
          clearInterval(intervalId);
          return;
        }
        const now = performance.now();
        const res = faceLandmarker.detectForVideo(videoElement, now);
        if (res?.faceLandmarks?.length) {
          // --- extract smile blend-shapes ---
          const blends = res.faceBlendshapes?.[0]?.categories ?? [];
          const smileL = blends[44]?.score ?? 0;   // 44 = mouthSmileLeft 
          const smileR = blends[45]?.score ?? 0;   // 45 = mouthSmileRight 

          port.postMessage({
            landmarks: res.faceLandmarks[0],
            smile: (smileL + smileR) / 2
          });

          // port.postMessage(res.faceLandmarks[0]);
        }
      }, 33);   // ~30 fps; even under “background-tab” throttling Chrome guarantees

      break;
    }

    /* -------------------- STOP -------------------- */
    case "STOP_CAMERA": {
      stopRequested = true;
      if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(t => t.stop());
        videoElement.srcObject = null;
      }
      console.log("Off-screen: camera stopped.");
      break;
    }
  }
}