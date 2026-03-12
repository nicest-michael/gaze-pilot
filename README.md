# Gaze Pilot

Eye tracking desktop app with gaze cursor, wink gestures, and voice typing control. Built with Electron, MediaPipe, and WebGazer.

## Features

- **Gaze tracking** — WebGazer estimates where you're looking on screen
- **Face mesh** — MediaPipe Face Landmarker for precise eye state detection
- **Wink gestures** — 5 gesture types mapped to actions:
  - Left double-wink: toggle gaze cursor visibility
  - Single left wink: click at current gaze position
  - Right double-wink: open voice typing (Win+H)
  - Single right wink: close voice typing
  - Long right eye hold: press Enter
- **Overlay cursor** — transparent always-on-top window shows gaze position
- **5-point calibration** — center + 4 corners with visual progress
- **Debug dashboard** — live camera feed with face mesh overlay, stats, and logs
- **Global shortcut** — Ctrl+Shift+G toggles tracking from anywhere

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build        # Build with electron-vite
npm run build:win    # Build Windows installer
```

## Architecture

Three-process Electron app:

- **Main** (`src/main/`) — Window management, IPC routing, gesture-to-action mapping, key/mouse simulation via `@nut-tree-fork/nut-js`
- **Preload** (`src/preload/`) — Typed IPC bridge exposing `window.api`
- **Renderer** (`src/renderer/`) — React UI with hash-based routing for multiple windows:
  - `#/main` — Primary app window with controls and status
  - `#/tracking` — Hidden window running camera + WebGazer + MediaPipe
  - `#/overlay` — Transparent fullscreen window for gaze cursor
  - `#/debug` — Camera feed, face mesh, stats, logs
  - `#/calibration` — 5-point calibration overlay

## Tech Stack

- Electron 40
- React 19 + Zustand
- MediaPipe Face Landmarker
- WebGazer 3.5.3
- Tailwind CSS 4
- @nut-tree-fork/nut-js (native input simulation)
- electron-vite
