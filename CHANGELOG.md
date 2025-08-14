# Changelog

## 0.4.0 (2025-08-14)

Full Changelog: [v0.3.0...v0.4.0](https://github.com/thshao2/head-tracking-chrome-extension/compare/v0.3.0...v0.4.0)

### Features:
- **Click Assist**: Added two additional configurable settings for “Click Assist”:
  - **The click assist radius (default stays at 100px):** This allows the user to change the click buffer radius (px) in which the cursor stays locked onto the interactive element. The value must be between 30-500px, or an error is shown.
  - **The click assist timeout (ms):** Gives an “expiration” time to locked cursor once the cursor leaves an interactive element. Once the cursor is outside of the locked interactive for more than this amount of time, the cursor automatically unlocks from it. The value must be between 500ms and 10000ms, or else an error is shown. The default value is 2000ms.
- **Click Assist:** The functionality of click assist has been improved so that it now accurately knows exactly where and when you have left an interactive element. This allows it to better determine the area (clickAssistRadius) and time (clickAssistTimeout) to which the cursor will stay locked onto the interactive element.
- **Dwell Click:** Added a visual “progress ring” to show users the remaining dwell time needed until the cursor will perform a click. The visual progress ring will only show once 40% of the dwell time has already elapsed.
- **File Upload:** Due to the fact that the handling of the file upload has been moved to the setup phase, a loading spinner has been added to show users that the file is being processed. In addition, a new and clear error message is displayed if the file upload is unsuccessful.

### Bug Fixes:
- Fixed a bug where the dwell-click timer would still be activated while the user was scrolling up/down a webpage (through hands-free edge scrolling). This could lead to unintended clicks being executed during hands-free scrolling.

### Chores
- **internal:** Refactor scrolling, facial gesture recognition, and settings logic into separate content scripts ([80544e3](https://github.com/thshao2/head-tracking-chrome-extension/commit/80544e3eff016162202b38803c805a86c5a8afc6)) ([8879e6d](https://github.com/thshao2/head-tracking-chrome-extension/commit/8879e6d90f82307cc87b33327ced46771703bc5a)) ([2e9f19a](https://github.com/thshao2/head-tracking-chrome-extension/commit/2e9f19a5069bd0ed36a4b27fd8ebbfa0964a56b5))
- **internal:** Refactor SetupView and StatusView into their own files in a new components/ folder in src/popup/* ([c024964](https://github.com/thshao2/head-tracking-chrome-extension/commit/c02496461ebeb14fc45f9526b9e6b3b49465982d))
- **internal:** Move component-specific styles in src/popup/* into separate .css files in a new styles/ folder ([55c516c](https://github.com/thshao2/head-tracking-chrome-extension/commit/55c516c027eae036330e1ca4e4ef9981e0a99e4b))
- **internal:** Code refactoring in tracker.js content script ([1c89e4b](https://github.com/thshao2/head-tracking-chrome-extension/commit/1c89e4b964374436a8a1b9cf7894c3b7f1e3eba6)) ([c89f9f5](https://github.com/thshao2/head-tracking-chrome-extension/commit/c89f9f5d5318016418790c6fcc724d2fba900349))
- **ci:** Extend Github Actions CI/CD pipeline to publish new releases to the public repository, as well as push the following updated content: public/**, manifest.json, CHANGELOG.md, README.md ([0b9ae96](https://github.com/thshao2/head-tracking-chrome-extension/commit/0b9ae968ee3454bafacc57841fed7c03f3d37180)) ([4f5d17f](https://github.com/thshao2/head-tracking-chrome-extension/commit/4f5d17fae3fb4e0ae6184dccc4b86634ddfa950f)) ([c353c5c](https://github.com/thshao2/head-tracking-chrome-extension/commit/c353c5ce546f0db574cb4bd70619edf080240d43)) ([2d5faa3](https://github.com/thshao2/head-tracking-chrome-extension/commit/2d5faa3265499025263ffb0bd242e93725dd2a65))

### Performance Upgrades:
- **Calibration File Upload:** The processing of the calibration file has now been moved to the setup phase. This prevents unnecessary/repeated processing of the calibration file every time the tracking process starts, even when the uploaded file remains the same. It also greatly reduces the time in which the tracking process starts from when the “Start Tracking” button is clicked, and prevents repeated processing of the calibration file in each new loaded webpage (refresh & new tab).

### Documentation
- Update README.md to include new settings for click assist, visual indicator for dwell-based clicking

## 0.3.0 (2025-08-04)

Full Changelog: [v0.2.2...v0.3.0](https://github.com/thshao2/head-tracking-chrome-extension/compare/v0.2.2...v0.3.0)

### Features:
- **Increased Sensitivity:** Increased the sensitivity of the jawOpen (open your mouth wide) facial gesture.
Dwell Click: Added a new setting to the settings section of the popup: “Enable Dwell Click” (toggle on/off). Turning this setting on will have the cursor generate a click action if the cursor dwells within a small px area (configured in the dwellArea setting) for more than some number of ms (configured in the dwellTime setting). The dwellArea setting allows the cursor to not have to be completely stopped to register a click action. If enabled, the user will be able to configure an additional two values:
  - The dwell area (px): Small movement threshold around the exact position to be clicked, in pixels of the screen. This is the pointer movement allowed while dwelling, before a click action is generated. The value must be between 3 - 100px, or an error is shown.
  - The dwell time (ms): Time to wait in ms before generating a click action. This value must be between 300 - 5000ms, or an error is shown.

### Bug Fixes:
- **BREAKING CHANGE:** Fixed an issue where the calibration data did not scale properly to different screen dimensions, thus having the cursor experience erratic, unpredictable behavior. To resolve this issue, new metadata has been added to the calibration file, storing the width x height of the screen dimensions the user performed the calibration in. Using this metadata, appropriate scaling to the cursor movement/position is carried out if the user decides to use the same calibration on a different device (with a smaller/larger screen resolution). For users who do not reuse the calibration file on different devices, this change will not affect the behavior of the cursor. However, for other users using the calibration file on different devices, a re-calibration is necessary. 

### Chores:
- **internal:** npm dependency internal version bump ([304f9c3](https://github.com/thshao2/head-tracking-chrome-extension/commit/304f9c3470ae72059f5b327be706d458db37ee0d))
- **internal:** refactor eslint.config.js, move globals to languageOptions object, add ignores to public/** and vite.config.js ([304f9c3](https://github.com/thshao2/head-tracking-chrome-extension/commit/304f9c3470ae72059f5b327be706d458db37ee0d)) ([a763019](https://github.com/thshao2/head-tracking-chrome-extension/commit/a763019bbe3881d330bb20a85cde1ab696e6b359))
- **internal:** fix all eslint warnings and errors, clean up unused functions in content scripts ([80cfc7d](https://github.com/thshao2/head-tracking-chrome-extension/commit/80cfc7d0dc4d388ccbe3c44bba8f0339760145a3)) ([289c767](https://github.com/thshao2/head-tracking-chrome-extension/commit/289c767f1c77a3daf31d7a15cecd22f56e53dea4))
- **docs:** add CHANGELOG.md file to repo ([5adb457](https://github.com/thshao2/head-tracking-chrome-extension/commit/5adb4576185f16e99827c937caa45b12957b0a22))
- **ci:** add GitHub Actions CI/CD pipeline for building and publishing new releases ([ffae8d4](https://github.com/thshao2/head-tracking-chrome-extension/commit/ffae8d4033a13bb658b777e0d41ea9887a708736))

## 0.2.2 (2025-07-24)

Full Changelog: [v0.2.1...v0.2.2](https://github.com/thshao2/head-tracking-chrome-extension/compare/v0.2.1...v0.2.2)

### Features:
- When clicking on “Start Head Tracking”, the cursor is now initialized at the center of the screen. Previously, it was at the top left corner. 

### Bug Fixes:
- Fixed an intermittent bug where the area and locations the cursor was allowed to move in were completely off once “Start Head Tracking” was clicked. This occurred due to a race condition in which the calibration file was still being processed under the hood, but the MediaPipe FaceLandmarker pipeline was already completed and sending facial landmark data. This resulted in a fallback algorithm being used that would attempt to control the cursor through a basic, uncalibrated mapping. This basic, uncalibrated algorithm caused unexpected behaviors to the location of the cursor even once the calibration file was fully processed.

## 0.2.1 (2025-07-23)

Full Changelog: [v0.2.0...v0.2.1](https://github.com/thshao2/head-tracking-chrome-extension/compare/v0.2.0...v0.2.1)

### Bug Fixes:
- Fixed a UI bug where if the user selected “Raise Eyebrows” as a click action, an incorrect description was shown. The correct description of “Raise your eyebrows to click” is now shown correctly for this respective click action.
- Fixed a bug where if a user opted to stop the head tracking process while a webpage was still scrolling, the page would continue to actively scroll.
- Fixed a bug where starting the head tracking process a second time would not properly reinitialize the cursor on all active tabs (excluding the current focused tab).

## 0.2.0 (2025-07-22)

Full Changelog: [v0.1.0...v0.2.0](https://github.com/thshao2/head-tracking-chrome-extension/compare/v0.1.0...v0.2.0)

### Features:
- **Increased Streaming Rate:** The rate at which the cursor’s position is updated has been increased from 30fps (30hz) -> 60fps (60hz). This allows for a smoother experience from the user.

- **Camera:** Once the user has granted the chrome extension “Allow” permission to access the camera, future openings of the chrome extension popup will automatically enable the camera, saving the user one additional click in the setup phase. At this point, the only button the user will ever need to click to start the head-tracking process is the button “Start Head Tracking”.
- **Settings:** Update the status page during head-tracking to include a “Settings” section. The settings section allows for the user to configure the following during tracking:
  - The exponential smoothing factor. A slider will allow the user to choose a value between 0.5 -> 0.99 (0.95 is the default).
  - An option to choose a click action to perform a “left-click” on a webpage. By default, no option is selected. The user can choose between three options (for now): smile, raise their eyebrows, and open your mouth wide.
  - Click Assist (explained in further detail below): The user can turn it on/off (default is off).
- **Auto-Save:** All settings are automatically saved by the Chrome Extension.
- **Click Assist:** Performing facial gestures while keeping the cursor inside an interactive element can be difficult. “Click Assist” creates a 100px buffer that allows the cursor to still be highlighted green (indicating that a click can be performed) even after moving up to 100px away from the interactive element. Thus, once a cursor enters an interactive element, it will be locked to that element (even if it enters a new button < 100px away) to allow the user to click on that interactive element even if the cursor moves some px off of it. In order to have the cursor become “unclocked” from an element, the user must move > 100px, and then can lock on to another interactive element.
- **Click Action:** Different users might find different facial gestures easier to perform, or better situated to the “clicking” use case (e.g. to prevent accidental clicking). Thus, a new option allows users to choose out of 3 facial gestures: smiling, raising their eyebrows, and opening their mouth/jaw, in order to perform a left-click. If the user may never need to perform a left-click, this feature can be turned off by setting the click action to “None”.


### Bug Fixes:

- Update the Exponential Smoothing Factor to use a parameter of $0.95^k$, where k=2 to replicate the behavior observed in the original head tracking [website](https://head-control-website.vercel.app/).
- **Camera Permissions Access:** Fixed a bug where if the user had the camera permission setting to “Ask (Default)”, an error message would still be displayed, forcing the user to have to navigate to the chrome extension settings and change the camera setting from “Ask (Default)” -> “Allow”. Now, if the user has the camera permission set to “Ask (Default)”, a new options tab will open, prompting the user the option to click on “Allow while visiting the site” and “Allow this time”. Unfortunately, due to how chrome extensions work, the user must click on “Allow while visiting this site” and NOT “Allow this time” to grant the chrome extension persistent access to the camera. New error alerts and clearer instructions have been added to ensure the user will not run into any issues/confusion in the setup phase.

## 0.1.0 (2025-07-18)

### Features:
- **Model:** MediaPipe [FaceLandmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) to collect landmark data and capture facial expressions.
- **On Installation:** Users can upload their .csv configuration file to the popup, and click on “Enable Camera”. If the user does not have a file yet, a link that goes to https://head-control-website.vercel.app/ will allow the user to get the configuration file. The file uploaded will be saved permanently so that the user will not have to re-upload the file after turning off their computer or closing Chrome, while allowing for the user to change the file if needed. In order for “Enable Camera” to be activated, users must go to “Details -> Site Settings” in the extension page and set “Camera -> Allow”. Keeping camera permissions at “Ask (Default)” will not work. A preview of the camera will be shown, and users will be able to click on “Start Head Tracking”.
- **Head-Tracking:** During the head-tracking process, a custom cursor will show up on the user’s current webpage, moving the cursor based on the user’s head movements. The user can click on “Stop Head Tracking” at any time to remove the cursor from the webpage and stop the tracking process. The cursor will be updated at a rate of 30fps (30hz).
- **Click Action:** Raising your eyebrows up (sensitivity of 0.2) will trigger a “click” on the webpage.
- **Cursor:** The cursor will be highlighted green every time it hovers over a link (indicating a clickable).
- **Hands-Free Scrolling:** Moving the cursor down to the bottom or top of the screen and holding it for one second will begin a smooth scroll down or up, respectively. This only works for webpages and does not work for pdfs, Google Docs, etc.
Tracking Configuration: The current system is default to a 2D coordinate system, 3 landmark points, and an exponential smoothing factor of 0.95 (not configurable as of now).
- Opening a new tab and going to a new website will create a new custom cursor for each new webpage opened.
- Navigating between current active tabs (that were open before clicking on “Start Head Tracking”) should also show the currently active custom cursor on each tab, although at this time it is still a little buggy.
- _Limitations_: The cursor is unable to move up to the tabstrip, or access certain browser UI elements in Chrome.