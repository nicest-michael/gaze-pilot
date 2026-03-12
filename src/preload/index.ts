import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Tracking window -> main
  sendGazeUpdate: (point: { x: number; y: number; confidence: number }) =>
    ipcRenderer.send('tracking:gaze-update', point),
  sendGesture: (gesture: string) =>
    ipcRenderer.send('tracking:gesture', gesture),
  sendDebugData: (data: unknown) =>
    ipcRenderer.send('tracking:debug-data', data),

  // Main -> tracking window
  onStartTracking: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('tracking:start', listener)
    return () => ipcRenderer.removeListener('tracking:start', listener)
  },
  onStopTracking: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('tracking:stop', listener)
    return () => ipcRenderer.removeListener('tracking:stop', listener)
  },
  onStartCalibration: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('calibration:start', listener)
    return () => ipcRenderer.removeListener('calibration:start', listener)
  },

  // Main -> overlay window
  onSetCursor: (callback: (x: number, y: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, x: number, y: number): void =>
      callback(x, y)
    ipcRenderer.on('overlay:set-cursor', listener)
    return () => ipcRenderer.removeListener('overlay:set-cursor', listener)
  },
  onSetVisible: (callback: (visible: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, visible: boolean): void =>
      callback(visible)
    ipcRenderer.on('overlay:set-visible', listener)
    return () => ipcRenderer.removeListener('overlay:set-visible', listener)
  },

  // Main -> debug window
  onDebugData: (callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown): void => callback(data)
    ipcRenderer.on('debug:data', listener)
    return () => ipcRenderer.removeListener('debug:data', listener)
  },

  // Calibration
  recordCalibrationPoint: (x: number, y: number) =>
    ipcRenderer.invoke('calibration:record-point', x, y),
  finishCalibration: () => ipcRenderer.invoke('calibration:finish'),
  startCalibration: () => ipcRenderer.invoke('calibration:start'),

  // Main window controls
  toggleTracking: () => ipcRenderer.invoke('tracking:toggle'),
  toggleDebug: () => ipcRenderer.invoke('debug:toggle'),
  onTrackingState: (callback: (state: { enabled: boolean; fps: number; confidence: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: { enabled: boolean; fps: number; confidence: number }): void =>
      callback(state)
    ipcRenderer.on('tracking:state', listener)
    return () => ipcRenderer.removeListener('tracking:state', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
