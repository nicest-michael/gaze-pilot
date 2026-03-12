/**
 * Electron main process entry point for Gaze Pilot.
 * Creates main (UI), tracking (hidden), overlay (transparent), and calibration (fullscreen) windows.
 * Routes IPC between windows and handles gesture-to-action mapping.
 */
import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import { KeySimulator } from './services/key-simulator'

let mainWindow: BrowserWindow | null = null
let trackingWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let calibrationWindow: BrowserWindow | null = null
let trackingEnabled = false
let cursorVisible = false
let latestGazePoint: { x: number; y: number } | null = null

const keySimulator = new KeySimulator()

// --- Window creation ---

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Gaze Pilot',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/main`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/main' })
  }

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

function createTrackingWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/tracking`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/tracking' })
  }

  return win
}

function createOverlayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    fullscreen: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.setIgnoreMouseEvents(true)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/overlay`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/overlay' })
  }

  return win
}

function createCalibrationWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/calibration`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/calibration' })
  }

  win.on('closed', () => {
    calibrationWindow = null
  })

  // Auto-start calibration once window is ready
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('calibration:start')
  })

  return win
}

// --- Tracking toggle ---

function broadcastTrackingState(fps?: number, confidence?: number): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tracking:state', {
      enabled: trackingEnabled,
      fps: fps ?? 0,
      confidence: confidence ?? 0
    })
  }
}

function toggleTracking(): void {
  trackingEnabled = !trackingEnabled

  if (trackingWindow && !trackingWindow.isDestroyed()) {
    if (trackingEnabled) {
      trackingWindow.webContents.send('tracking:start')
    } else {
      trackingWindow.webContents.send('tracking:stop')
      // Hide cursor when tracking stops
      cursorVisible = false
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay:set-visible', false)
      }
    }
  }

  broadcastTrackingState()
  console.log(`[gaze-pilot] Tracking ${trackingEnabled ? 'enabled' : 'disabled'}`)
}

// --- Gesture handling ---

async function handleGesture(gesture: string): Promise<void> {
  console.log(`[gaze-pilot] Gesture: ${gesture}`)

  switch (gesture) {
    case 'left_double_wink': {
      // Toggle overlay cursor visibility
      cursorVisible = !cursorVisible
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay:set-visible', cursorVisible)
      }
      break
    }

    case 'single_left_wink': {
      // Click at latest gaze position
      if (latestGazePoint) {
        await keySimulator.clickAt(latestGazePoint.x, latestGazePoint.y)
      }
      break
    }

    case 'right_double_wink': {
      // Toggle voice typing (Win+H)
      await keySimulator.toggleVoiceTyping()
      break
    }

    case 'single_right_wink': {
      // Stop voice typing (Win+H then Escape)
      await keySimulator.stopVoiceTyping()
      break
    }

    case 'long_right_wink': {
      // Press Enter (send message)
      await keySimulator.pressEnter()
      break
    }
  }
}

// --- IPC handlers ---

function registerIpcHandlers(): void {
  // Tracking window -> main: gaze data
  ipcMain.on(
    'tracking:gaze-update',
    (_event, point: { x: number; y: number; confidence: number }) => {
      latestGazePoint = { x: point.x, y: point.y }

      // Forward to overlay
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay:set-cursor', point.x, point.y)
      }
    }
  )

  // Tracking window -> main: gesture event
  ipcMain.on('tracking:gesture', (_event, gesture: string) => {
    handleGesture(gesture).catch((err) => {
      console.error('[gaze-pilot] Gesture handler error:', err)
    })
  })

  // Tracking window -> main: debug data — forward to main window
  ipcMain.on('tracking:debug-data', (_event, data: any) => {
    if (mainWindow && !mainWindow.isDestroyed() && data) {
      mainWindow.webContents.send('debug:data', data)
      mainWindow.webContents.send('tracking:state', {
        enabled: trackingEnabled,
        fps: data.fps ?? 0,
        confidence: data.confidence ?? 0
      })
    }
  })

  // Calibration IPC — forward points to tracking window for WebGazer training
  ipcMain.handle('calibration:record-point', (_event, x: number, y: number) => {
    console.log(`[gaze-pilot] Calibration point recorded: (${x}, ${y})`)
    // Forward to tracking window so WebGazer can train on this point
    if (trackingWindow && !trackingWindow.isDestroyed()) {
      trackingWindow.webContents.send('calibration:point', x, y)
    }
    return { ok: true }
  })

  ipcMain.handle('calibration:finish', () => {
    console.log('[gaze-pilot] Calibration finished')
    // Close the calibration window
    if (calibrationWindow && !calibrationWindow.isDestroyed()) {
      calibrationWindow.close()
      calibrationWindow = null
    }
    return { ok: true }
  })

  // Main window IPC
  ipcMain.handle('tracking:toggle', () => {
    toggleTracking()
    return { enabled: trackingEnabled }
  })

  ipcMain.handle('calibration:start', () => {
    if (!trackingEnabled) {
      return { ok: false, error: 'Tracking must be enabled first' }
    }
    // Create a fullscreen calibration window
    if (calibrationWindow && !calibrationWindow.isDestroyed()) {
      calibrationWindow.focus()
    } else {
      calibrationWindow = createCalibrationWindow()
    }
    return { ok: true }
  })
}

// --- App lifecycle ---

app.whenReady().then(() => {
  console.log('[gaze-pilot] App ready')

  // Register IPC handlers before creating windows
  registerIpcHandlers()

  // Create windows
  mainWindow = createMainWindow()
  trackingWindow = createTrackingWindow()
  overlayWindow = createOverlayWindow()

  // Register global shortcut: Ctrl+Shift+G toggles tracking
  const registered = globalShortcut.register('Ctrl+Shift+G', () => {
    toggleTracking()
  })
  if (!registered) {
    console.error('[gaze-pilot] Failed to register global shortcut Ctrl+Shift+G')
  }

  console.log('[gaze-pilot] Initialization complete')
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
})
