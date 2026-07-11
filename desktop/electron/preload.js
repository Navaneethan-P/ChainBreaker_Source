// Electron preload — CommonJS required here (Electron restriction).
// contextBridge only accepts CJS in this context even with "type":"module".
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('acm', {
  // App
  isFirstRun:      () => ipcRenderer.invoke('app:is-first-run'),
  markInitialized: () => ipcRenderer.invoke('app:mark-initialized'),
  getVersion:      () => ipcRenderer.invoke('app:get-version'),
  getBackendPort:  () => ipcRenderer.invoke('app:backend-port'),

  // System checks
  checkOllama:  () => ipcRenderer.invoke('system:check-ollama'),
  checkBackend: () => ipcRenderer.invoke('system:check-backend'),

  // Ollama model management
  pullModel: (modelName) => ipcRenderer.invoke('ollama:pull-model', modelName),
  onPullProgress: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('ollama:pull-progress', handler)
    return () => ipcRenderer.removeListener('ollama:pull-progress', handler)
  },

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // Dialogs
  openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
  openFile:      () => ipcRenderer.invoke('dialog:open-file'),
})
