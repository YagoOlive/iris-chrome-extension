// src/offscreen/index.js

import { VERSION, FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

let camera = null;
let faceMesh = null;
const videoElement = document.getElementById("offscreen-video");

// --- PORT CONNECTION ---
const port = chrome.runtime.connect({ name: 'offscreen' });
port.onMessage.addListener(handleMessages);

async function handleMessages(msg) {
  switch (msg.cmd) {
    case 'START_CAMERA':
      if (camera) {
        console.log('Offscreen: Camera is already active.');
        return;
      }
      try {
        console.log('Offscreen: START_CAMERA command received.');

        // 1. Create the FaceMesh instance
        faceMesh = new FaceMesh({
          locateFile: (file) => {
            const path = `vendor/mediapipe/${file}`;
            const url = chrome.runtime.getURL(path);
            // This will now print to the offscreen document's console
            console.log(`Offscreen: Locating MediaPipe asset: ${file} -> ${url}`);
            return url;
          },
        });

        /*
        face_mesh_solution_packed_assets_loader.js -> https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh_solution_packed_assets_loader.js
        face_mesh_solution_simd_wasm_bin.js -> https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh_solution_simd_wasm_bin.js
        face_mesh.binarypb -> https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.binarypb
        face_mesh_solution_packed_assets.data -> https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh_solution_packed_assets.data
        face_mesh_solution_simd_wasm_bin.wasm -> https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh_solution_simd_wasm_bin.wasm
        */

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results) => {
          // Debugging: This does not print.
          console.log("Offscreen: MediaPipe got results!", results.multiFaceLandmarks.length);
          if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            port.postMessage(results.multiFaceLandmarks[0]);
          }
        });

        faceMesh.onerror = (error) => {
          console.error("Offscreen: MediaPipe FaceMesh error:", error);
        };

        // 2. KEY FIX: Wait for the model to be fully initialized before proceeding.
        // This solves the race condition.
        console.log("Offscreen: Initializing FaceMesh model...");
        await faceMesh.initialize();
        console.log("Offscreen: FaceMesh model initialized successfully.");

        // 3. Now that the model is ready, get the camera stream.
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        await new Promise((resolve) => { videoElement.onloadedmetadata = resolve; });

        // 4. Setup and start the MediaPipe Camera utility.
        camera = new Camera(videoElement, {
          onFrame: async () => {
            await faceMesh.send({ image: videoElement });
          },
          width: 1280,
          height: 720,
        });

        await camera.start();
        console.log("Offscreen: Camera started and sending frames to FaceMesh.");

      } catch (err) {
        console.error('Offscreen: An error occurred during camera/MediaPipe startup.', err);
        if (camera) {
          await camera.stop();
          camera = null;
        }
      }
      break;

    case 'STOP_CAMERA':
      console.log('Offscreen: STOP_CAMERA command received.');
      if (camera) {
        await camera.stop();
        camera = null;
        console.log('Offscreen: Camera stopped.');
      }
      if (faceMesh) {
        await faceMesh.close();
        faceMesh = null;
        console.log('Offscreen: FaceMesh resources released.');
      }
      break;
  }
}