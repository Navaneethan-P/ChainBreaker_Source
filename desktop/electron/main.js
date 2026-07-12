// Electron main process — CommonJS
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')

const isDev = process.env.NODE_ENV === 'development'
const BACKEND_PORT = 8000
let backendProcess = null
let mainWindow = null

// ─── Backend Management ────────────────────────────────────────────────────────

function resolveBackendPath() {
  if (isDev) {
    return path.join(__dirname, '../../backend')
  }
  return path.join(process.resourcesPath, 'backend')
}

function findPython() {
  const candidates = ['python', 'python3', 'py']
  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: 'ignore' })
      return candidate
    } catch (_) {}
  }
  return null
}

function startBackend() {
  const backendDir = resolveBackendPath()
  const python = findPython()

  if (!python) {
    dialog.showErrorBox(
      'Python Not Found',
      'Attack Chain Mapper requires Python 3.11 or later.\n\nPlease install Python from python.org and relaunch.'
    )
    app.quit()
    return
  }

  const env = {
    ...process.env,
    CORS_ORIGINS: 'http://localhost:5173,app://.',
    PYTHONUNBUFFERED: '1',
  }

  backendProcess = spawn(python, [
    '-m', 'uvicorn', 'main:app',
    '--port', String(BACKEND_PORT),
    '--host', '127.0.0.1',
  ], {
    cwd: backendDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stdout.on('data', (data) => {
    if (isDev) process.stdout.write(`[backend] ${data}`)
  })
  backendProcess.stderr.on('data', (data) => {
    if (isDev) process.stderr.write(`[backend:err] ${data}`)
  })
  backendProcess.on('exit', (code) => {
    if (isDev) console.log(`[backend] exited with code ${code}`)
  })
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM')
    backendProcess = null
  }
}

// ─── First-Run Detection ───────────────────────────────────────────────────────

function isFirstRun() {
  const marker = path.join(app.getPath('userData'), '.initialized')
  return !fs.existsSync(marker)
}

function markInitialized() {
  const marker = path.join(app.getPath('userData'), '.initialized')
  fs.writeFileSync(marker, new Date().toISOString())
}

// ─── Window Creation ───────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#F0F7FF',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#FFFFFF',
      symbolColor: '#0EA5E9',
      height: 38,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    icon: path.join(__dirname, '../assets/icon.png'),
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Uncomment to open DevTools automatically in dev:
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (['https:', 'http:'].includes(parsed.protocol)) {
        shell.openExternal(url)
      }
    } catch (e) {
      // Invalid URL
    }
    return { action: 'deny' }
  })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('app:is-first-run',       () => isFirstRun())
ipcMain.handle('app:mark-initialized',   () => markInitialized())
ipcMain.handle('app:reset-initialized',  () => {
  const marker = path.join(app.getPath('userData'), '.initialized')
  if (fs.existsSync(marker)) fs.unlinkSync(marker)
})
ipcMain.handle('app:get-version',        () => app.getVersion())
ipcMain.handle('app:backend-port',       () => BACKEND_PORT)

ipcMain.handle('system:check-ollama', () => {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 }, (res) => {
      let body = ''
      res.on('data', (d) => (body += d))
      res.on('end', () => {
        try {
          const data = JSON.parse(body)
          resolve({ running: true, models: data.models || [] })
        } catch {
          resolve({ running: false, models: [] })
        }
      })
    })
    req.on('error', () => resolve({ running: false, models: [] }))
    req.on('timeout', () => { req.destroy(); resolve({ running: false, models: [] }) })
  })
})

ipcMain.handle('system:check-backend', () => {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, { timeout: 3000 }, (res) => {
      resolve({ running: res.statusCode === 200 })
    })
    req.on('error', () => resolve({ running: false }))
    req.on('timeout', () => { req.destroy(); resolve({ running: false }) })
  })
})

ipcMain.handle('ollama:pull-model', (_, modelName) => {
  mainWindow.webContents.send('ollama:pull-progress', { status: 'starting', model: modelName })

  return new Promise((resolve) => {
    const proc = spawn('ollama', ['pull', modelName], { stdio: ['ignore', 'pipe', 'pipe'] })

    proc.stdout.on('data', (data) => {
      const line = data.toString().trim()
      mainWindow.webContents.send('ollama:pull-progress', { status: 'progress', raw: line, model: modelName })
    })

    proc.on('exit', (code) => {
      resolve(code === 0 ? { success: true } : { success: false, error: `ollama pull exited with code ${code}` })
    })

    proc.on('error', (err) => resolve({ success: false, error: err.message }))
  })
})

ipcMain.handle('shell:open-external', (_, url) => {
  try {
    const parsed = new URL(url)
    if (['https:', 'http:'].includes(parsed.protocol)) {
      shell.openExternal(url)
    }
  } catch (e) {}
})

// Start Ollama server in background
let ollamaServerProcess = null
ipcMain.handle('ollama:start-server', () => {
  return new Promise((resolve) => {
    if (ollamaServerProcess && !ollamaServerProcess.killed) {
      resolve({ started: true, already: true })
      return
    }
    try {
      ollamaServerProcess = spawn('ollama', ['serve'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      })
      ollamaServerProcess.on('error', (err) => {
        resolve({ started: false, error: err.message })
      })
      // Give it 2 seconds to start
      setTimeout(() => resolve({ started: true, pid: ollamaServerProcess.pid }), 2000)
    } catch (err) {
      resolve({ started: false, error: err.message })
    }
  })
})

// Get system information
ipcMain.handle('system:get-system-info', () => {
  const results = {}
  const tools = [
    { key: 'python', cmd: 'python --version' },
    { key: 'git', cmd: 'git --version' },
    { key: 'ollama', cmd: 'ollama --version' },
    { key: 'node', cmd: 'node --version' },
    { key: 'semgrep', cmd: 'semgrep --version' },
  ]
  for (const tool of tools) {
    try {
      const out = execSync(tool.cmd, { stdio: 'pipe', timeout: 3000 }).toString().trim()
      results[tool.key] = { installed: true, version: out.split('\n')[0].slice(0, 60) }
    } catch {
      results[tool.key] = { installed: false, version: null }
    }
  }
  results.platform = process.platform
  results.arch = process.arch
  return results
})

ipcMain.handle('dialog:open-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Repository Folder',
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Archives', extensions: ['zip', 'tar', 'gz'] }],
    title: 'Select Repository Archive',
  })
  return result.canceled ? null : result.filePaths[0]
})

// ─── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // In dev, the developer runs uvicorn manually.
  // In production, Electron spawns and owns the backend process.
  if (!isDev) {
    startBackend()
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => stopBackend())

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})
