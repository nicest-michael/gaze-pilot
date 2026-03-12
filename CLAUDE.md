# CLAUDE.md

## What This Is

Gaze Pilot is a standalone Electron app for eye-tracking-based computer control. It provides a gaze cursor, wink gestures for clicking, voice typing control, and calibration — usable system-wide with any application.

## Commands

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build with electron-vite
npm run build:win    # Build Windows NSIS installer
```

No test framework is configured.

### Build Quirks

- **Spaces in path**: The repo lives under `Michael Salzinger/`. Use `--config.npmRebuild=false` with electron-builder.
- **Code signing**: Skip on dev builds with `--config.win.signAndEditExecutable=false`.

## Architecture

Three-process Electron app: **main** (Node.js, key/mouse simulation), **preload** (IPC bridge), **renderer** (React UI with multiple windows via hash routes).

### Windows

1. **Tracking window** (hidden) — runs camera, MediaPipe Face Landmarker, WebGazer gaze estimation
2. **Overlay window** (transparent, click-through, always-on-top) — renders gaze cursor dot
3. **Debug window** (optional) — camera feed, face mesh, stats, logs
4. **Calibration window** (modal) — 5-dot screen-wide calibration

### Hash Routes

- `#/tracking` (default) — hidden tracking window
- `#/overlay` — transparent cursor overlay
- `#/debug` — debug dashboard
- `#/calibration` — calibration overlay

### Gesture Mapping

| Gesture | Action |
|---------|--------|
| Left double-wink | Toggle gaze cursor visibility |
| Single left wink | Click at gaze position |
| Right double-wink | Open voice typing (Win+H) |
| Single right wink | Close voice typing (Escape) |
| Long right eye hold | Enter (send) |

### Key Services

- `key-simulator.ts` — Native key/mouse simulation via `@nut-tree-fork/nut-js`
- WebGazer.js — Gaze position estimation
- MediaPipe Face Landmarker — Face mesh for wink detection via EAR (Eye Aspect Ratio)

## Tech Stack

Electron, TypeScript, React 19, Zustand, Tailwind CSS 4, MediaPipe, WebGazer, nut-js
