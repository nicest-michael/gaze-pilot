/**
 * Electron main process entry point for Gaze Pilot.
 * Creates tracking (hidden), overlay (transparent), and debug (optional) windows.
 * Routes IPC between windows and handles gesture-to-action mapping.
 */
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  nativeImage
} from 'electron'
import { join } from 'path'
import { KeySimulator } from './services/key-simulator'

let trackingWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let debugWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trackingEnabled = false
let cursorVisible = false
let latestGazePoint: { x: number; y: number } | null = null

const keySimulator = new KeySimulator()

// --- Window creation ---

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

function createDebugWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Gaze Pilot - Debug',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/debug`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/debug' })
  }

  win.on('closed', () => {
    debugWindow = null
  })

  return win
}

// --- Tray ---

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: trackingEnabled ? 'Stop Tracking' : 'Start Tracking',
      click: (): void => toggleTracking()
    },
    {
      label: 'Calibrate...',
      click: (): void => {
        if (trackingWindow && !trackingWindow.isDestroyed()) {
          trackingWindow.webContents.send('calibration:start')
        }
      }
    },
    {
      label: debugWindow ? 'Close Debug Window' : 'Debug Window',
      click: (): void => toggleDebugWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: (): void => {
        app.quit()
      }
    }
  ])
}

function createTray(): void {
  // Create a simple 16x16 tray icon
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
        'KklEQVR42mL8z8BQz0BAwMDIQARgYqASGDVg1IBRA0YNGDVg' +
        '1AAqGAAAFfYBEZpd0bsAAAAASUVORK5CYII=',
      'base64'
    )
  )
  tray = new Tray(icon)
  tray.setToolTip('Gaze Pilot')
  tray.setContextMenu(buildTrayMenu())
}

function updateTray(): void {
  if (tray) {
    tray.setContextMenu(buildTrayMenu())
    tray.setToolTip(`Gaze Pilot${trackingEnabled ? ' (Tracking)' : ''}`)
  }
}

// --- Tracking toggle ---

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

  updateTray()
  console.log(`[gaze-pilot] Tracking ${trackingEnabled ? 'enabled' : 'disabled'}`)
}

function toggleDebugWindow(): void {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.close()
    debugWindow = null
  } else {
    debugWindow = createDebugWindow()
  }
  updateTray()
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

      // Forward to debug window
      if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.webContents.send('debug:data', {
          type: 'gaze',
          point
        })
      }
    }
  )

  // Tracking window -> main: gesture event
  ipcMain.on('tracking:gesture', (_event, gesture: string) => {
    handleGesture(gesture).catch((err) => {
      console.error('[gaze-pilot] Gesture handler error:', err)
    })
  })

  // Tracking window -> main: debug data
  ipcMain.on('tracking:debug-data', (_event, data: unknown) => {
    if (debugWindow && !debugWindow.isDestroyed()) {
      debugWindow.webContents.send('debug:data', data)
    }
  })

  // Calibration IPC
  ipcMain.handle('calibration:record-point', (_event, x: number, y: number) => {
    console.log(`[gaze-pilot] Calibration point recorded: (${x}, ${y})`)
    return { ok: true }
  })

  ipcMain.handle('calibration:finish', () => {
    console.log('[gaze-pilot] Calibration finished')
    return { ok: true }
  })
}

// --- App lifecycle ---

app.whenReady().then(() => {
  console.log('[gaze-pilot] App ready')

  // Register IPC handlers before creating windows
  registerIpcHandlers()

  // Create windows
  trackingWindow = createTrackingWindow()
  overlayWindow = createOverlayWindow()

  // Create system tray
  createTray()

  // Register global shortcut: Ctrl+Shift+G toggles tracking
  const registered = globalShortcut.register('Ctrl+Shift+G', () => {
    toggleTracking()
  })
  if (!registered) {
    console.error('[gaze-pilot] Failed to register global shortcut Ctrl+Shift+G')
  }

  console.log('[gaze-pilot] Initialization complete')
})

// System tray app: don't quit when windows close
app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
})
