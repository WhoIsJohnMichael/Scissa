# Scissa — Everyday Video Splitter ✂️

Scissa is a stunning, premium, flat-white minimalist desktop application designed to cut videos instantly and losslessly. 

Unlike heavy encoding suites that take hours and degrade video quality, Scissa uses rapid **stream-copy technology** to slice videos in under 5 seconds with absolutely **zero quality loss**.

---

## ⚡ Key Features

* **White Minimalist Aesthetics**: A clean, pristine, ad-free, and distraction-free interface matching Scissa's custom scissor branding.
* **Instant, Lossless Slicing**: Employs rapid stream-copy splitting (`-c copy`) under the hood to cut high-definition videos instantly without re-encoding.
* **Dual Cutting Modes**:
  * **Split by Size**: Input a target segment size (e.g. `80 MB` to fit Discord upload limits) and let Scissa estimate the clips.
  * **Split by Duration**: Input a target segment length in minutes (e.g. `5 minutes`).
* **Visual Segments Preview**: Displays a beautiful timeline of estimated segment cards showing rounded file sizes, duration times, and timeline timestamps.
* **Advanced Mode Toggle**: Hides raw logs, codec configurations, and algebraic calculation sheets from everyday users, while letting power users toggle them on with a single header switch.
* **Onboarding welcome wizard**: A friendly, step-by-step wizard to guide new users through configuring FFmpeg on their first launch.
* **Flexible Save Locations**:
  * Double-click/Type directly into the output directory input box to name and recursively create custom folders.
  * Set a persistent **Default Output Directory** fallback inside settings to pre-populate custom folders automatically.

---

## 🚀 How to Run locally

### 1. Prerequisites
Ensure you have [Node.js (v18+)](https://nodejs.org/) installed.

### 2. Installation
Open your terminal (PowerShell or Command Prompt), navigate to this project folder, and install the dependencies:
```bash
npm install
```

### 3. Launching
Start the desktop application:
```bash
npm start
```

---

## ⚙️ Initial Configuration

When launching the application for the first time, Scissa's **Welcome Wizard** will pop up to guide you:
1. Simply locate your local `ffmpeg.exe` file.
2. Select it to configure the path.
3. You are ready to split!

---

## 📦 How to Build the Installer

We use `electron-builder` to package Scissa into a standalone production installer.

To compile a one-click standalone installer `.exe` for Windows:
```bash
npm run dist
```
Once completed, look inside your newly created `dist/` directory for the installer:
* `dist/Scissa Setup 1.0.0.exe`

---

## 🛠️ Technology Stack & Structure

* **Main Process (`main.js`)**: Coordinates Electron window events, native file/folder picker dialogs, settings caching, and FFmpeg spawning subprocesses.
* **Preload Bridge (`preload.js`)**: Safely exposes secure, sandboxed context bridge bridges (`loadSettings`, `saveSettings`, `openLink`) ensuring Microsoft Store-compliant IPC.
* **Renderer Logic (`renderer.js`)**: Manages UI state, onboarding wizard flows, Range Sliders, and segment map rendering.
* **Visuals (`styles.css`)**: Premium minimalist layouts, custom checkbox sliding toggles, segment borders, and rounded visual card highlights.

---

## 📄 License
This project is licensed under the MIT License.
