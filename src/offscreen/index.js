// src/offscreen/index.js

import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

let faceLandmarker = null;
let stopRequested = false;

let fps = 60;
let refreshMs = Math.round((1000 / fps) * 100) / 100;

// --- PORT CONNECTION ---
// O documento offscreen sobrevive ao encerramento do service worker (MV3),
// mas a porta não. Sem reconexão, os landmarks parariam de chegar ao background
// após qualquer restart do worker (ex.: navegação depois de ~30s de inatividade).
let port = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let shuttingDown = false; // set once STOP_CAMERA is received

function connectPort() {
  reconnectTimer = null;
  if (shuttingDown) return;
  try {
    port = chrome.runtime.connect({ name: 'offscreen' });
  } catch {
    // Runtime ainda indisponível — tenta de novo.
    scheduleReconnect();
    return;
  }
  reconnectAttempts = 0;
  port.onMessage.addListener(handleMessages);
  port.onDisconnect.addListener(() => {
    port = null;
    // Service worker caiu (ou foi reciclado) — reconecta para retomar o stream.
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (shuttingDown || reconnectTimer) return;
  // Cap retries so an orphaned document (parent gone for good) doesn't spin forever.
  if (reconnectAttempts >= 40) return;
  reconnectAttempts++;
  reconnectTimer = setTimeout(connectPort, 250);
}

connectPort();

const videoElement = document.getElementById("offscreen-video");
videoElement.playsInline = true;
videoElement.muted = true;

async function handleMessages(msg) {
  switch (msg.cmd) {
    /* -------------------- START -------------------- */
    case "START_CAMERA": {
      shuttingDown = false;
      /* Load WASM + model exactly once */
      if (!faceLandmarker) {
        const vision = await FilesetResolver.forVisionTasks(
          chrome.runtime.getURL("vendor/tasks-vision/wasm")
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

      /* Open camera */
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElement.srcObject = stream;
      await new Promise(r => videoElement.onloadedmetadata = r);
      await videoElement.play();
      console.log("Off-screen: camera playing…");

      stopRequested = false;
      const intervalId = setInterval(() => {
        if (stopRequested) {
          clearInterval(intervalId);
          return;
        }

        // Guard: skip frames until the video element has real decoded dimensions.
        // readyState >= 2 (HAVE_CURRENT_DATA) means at least one frame is available.
        // videoWidth/videoHeight being 0 would cause MediaPipe's ROI check to fail.
        if (
          videoElement.readyState < 2 ||
          videoElement.videoWidth === 0 ||
          videoElement.videoHeight === 0
        ) {
          return;
        }

        const now = performance.now();
        const res = faceLandmarker.detectForVideo(videoElement, now);
        if (res?.faceLandmarks?.length) {
          const blends = res.faceBlendshapes?.[0]?.categories ?? [];
          port?.postMessage({
            landmarks: res.faceLandmarks[0],
            blends: blends
          });
        }
      }, refreshMs);

      break;
    }

    /* -------------------- STOP -------------------- */
    case "STOP_CAMERA": {
      shuttingDown = true;
      stopRequested = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(t => t.stop());
        videoElement.srcObject = null;
      }
      console.log("Off-screen: camera stopped.");
      break;
    }
  }
}
