# Head-Tracking Pointer - Chrome Extension

This public repository contains development releases of a personalized head-tracking system, implemented as a Chrome Extension. This system was developed in the [UCSC Computer Vision Lab](https://vision.soe.ucsc.edu/welcome-ucsc-computer-vision-lab) under the supervision of Professor Roberto Manduchi, and is inspired by the insights and research presented in the paper [_Towards Personalized Head-Tracking Pointing_](https://escholarship.org/content/qt26z6d0t4/qt26z6d0t4.pdf) by Muratcan Cicek and Roberto Manduchi.

Head-tracking pointing is an effective interface for those with limited hand mobility, such as those with upper limb motor impairment, who cannot use their hands to operate a mouse. This elimiates the need for physical pointing tools such as mouthsticks or head-mounted styluses. Instead, users can control a virtual pointer on the computer screen through natural head movements. The goal of this new system is to address the following issues:

1. 🎯 Personalization — Traditional head-pointer systems often require users to adapt to a pre-defined control algorithm mapping head motion to cursor movement. Because different individuals may prefer to adopt different head motion patterns to accomplish the same goal, this can result in poor pointing performance. Our system instead learns from a user’s own natural motion patterns, which is critical for users with constrained or imprecise motor control.

2. 🌐 Accessibility — For many users who use the Chrome Browser to perform many of their tasks, a browser extension that implements this functionality would allow for greater accessibility and convenience. Deploying the system as a Chrome Extension provides seamless support for web-based tasks without requiring external software.

3. ⚡ Accuracy — Unfortunately, using current technology, typical interaction tasks are substantially slower and less accurate with head pointing than with a hand-controlled mouse, as shown in multiple previous studies. The goal of this head-tracking pointing system is to allow for higher accuracy and faster completion of pointing tasks.

## Setup/Installation

To try the Chrome Extension locally:

1. Download the latest .zip file from the _Releases_ section of this repository.
2. Unzip the file on your computer.
3. On your chrome browser, navigate to `chrome://extensions` and enable **Developer Mode**.
4. On the top left of the page: Click **Load unpacked**, then select the `/dist` folder from the extracted files.
  
    ⚠️ Make sure to upload the actual `/dist` folder — uploading the parent directory will result in an error.

## Usage

### 📁 Initial Setup

1. **Upload a Calibration File**

    This .csv file maps your personal head movement to cursor motion. If you don’t have one:

    - Click “Run calibration site” in the extension popup.

    - You’ll be taken to a guided calibration tool with two options:

      - With a growing line: Recommended for first-time users.

      - Without a growing line: A more precise, fixed-point calibration.
 
    Follow the instructions by moving your head to target each red dot on the screen, as if you were moving a cursor to each of the red dots.


2. **Enable Camera Access**. 

    If not already granted, click “Enable Camera” in the popup. You will be prompted to give the extension permission:

      - Select “Allow while visiting this site” — this ensures persistent access.

      - ⚠️ Do not select “Allow this time”, as it won’t grant sufficient access.


3. Click **"Start Head Tracking"** to begin using the system.

### Head Tracking & Cursor Behavior

- A cursor will appear on every page you visit, which will be highlighted green when there is a clickable element.
- To **scroll**:
  - Move the cursor to the top or bottom edge of the page and hold it there. 
- To **click**:
  - Use facial gestures (see settings), or enable dwell click (see settings).
- To **stop**, open the popup and click **“Stop Head Tracking”**.
- Cursor interaction is restricted to webpage content only (due to Chrome extension limitations).


### Cursor Features

- To scroll up and down a page, move the cursor to the very top or bottom the page, respectively. Hold in place to begin a smooth scroll up or down.
- The cursor will be highlighted green every time it hovers over a clickable element in the page.
- You can perform a specific facial gesture (configured in tracking settings, see below) to perform a left-click, or turn on dwell click.

### ⚙️ Settings

Open the popup again while tracking will to configure the following:
1. Smoothing Factor. 

    Adjust the cursor responsiveness:

    - Lower values → faster, more sensitive cursor

    - Higher values → smoother, more stable cursor

2. 😄 Click Action (Facial Gesture)

    The facial gesture you can perform to left-click. Choose between:
      - Smile
      - Raising your eyebrows
      - Open mouth wide

3. 🧲 Click Assist. 

    Helps reduce accidental cursor drift during a facial gesture. “Click Assist” locks the cursor to interactive, clickable elements up to a 100px radius once you have entered inside of it. To unlock the cursor from an interactive element, move >100px away.

4. ⏱️ Dwell Click 

    Triggers a click after the cursor remains within a small area for a specified duration. Allows for two additional configurable settings:

      - Dwell Area (in pixels):
        Allowed movement range while dwelling (3–100 px). Enables clicks without needing the cursor to be perfectly still.

      - Dwell Time (in milliseconds):
        Time to remain within the dwell area before clicking (300–5000 ms).

✅ All settings are automatically saved and persist across sessions.



