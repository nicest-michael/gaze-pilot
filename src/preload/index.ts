import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // IPC methods will be added here
})
