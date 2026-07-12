import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://127.0.0.1:8000'

// ─── Icons ─────────────────────────────────────────────────────────────────────
const IconGithub = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <path d="M8 1C4.134 1 1 4.134 1 8c0 3.09 2.004 5.715 4.785 6.638.35.064.479-.151.479-.336v-1.18c-1.947.424-2.356-.937-2.356-.937-.319-.808-.778-1.023-.778-1.023-.636-.434.048-.425.048-.425.703.05 1.073.72 1.073.72.624 1.07 1.638.76 2.037.582.063-.453.244-.76.444-.935-1.553-.176-3.185-.777-3.185-3.458 0-.764.273-1.388.72-1.878-.072-.177-.312-.888.068-1.851 0 0 .587-.188 1.923.717A6.707 6.707 0 018 4.776a6.71 6.71 0 011.75.235c1.336-.905 1.922-.717 1.922-.717.381.963.141 1.674.069 1.851.448.49.72 1.114.72 1.878 0 2.688-1.635 3.28-3.191 3.453.251.216.474.644.474 1.298v1.924c0 .187.127.403.482.335C12.999 13.712 15 11.088 15 8c0-3.866-3.134-7-7-7z"/>
  </svg>
)
const IconFolder = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <path d="M2 4.5A1.5 1.5 0 013.5 3h3l1.5 2H13a1.5 1.5 0 011.5 1.5v6A1.5 1.5 0 0113 14H3a1.5 1.5 0 01-1.5-1.5v-8z"/>
  </svg>
)
const IconFile = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z"/>
    <path d="M9 1v4h4"/>
  </svg>
)
const IconCode = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <path d="M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12"/>
  </svg>
)
const IconShield = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 13, height: 13, flexShrink: 0 }}>
    <path d="M8 1L2 3.5v4C2 11 5 13.5 8 15c3-1.5 6-4 6-7.5v-4L8 1z"/>
  </svg>
)
const IconCpu = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 13, height: 13, flexShrink: 0 }}>
    <rect x="4" y="4" width="8" height="8" rx="1"/>
    <path d="M6 1v3M10 1v3M6 12v3M10 12v3M1 6h3M1 10h3M12 6h3M12 10h3"/>
  </svg>
)
const IconPlay = () => (
  <svg viewBox="0 0 14 14" fill="currentColor" style={{ width: 12, height: 12, flexShrink: 0 }}>
    <polygon points="3,2 11,7 3,12"/>
  </svg>
)
const IconLink = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 12, height: 12 }}>
    <path d="M9 5h3a3 3 0 010 6h-3M7 11H4a3 3 0 010-6h3M5 8h6"/>
  </svg>
)

const INPUT_MODES = [
  { id: 'url',    label: 'GitHub URL',     Icon: IconGithub },
  { id: 'local',  label: 'Local Folder',   Icon: IconFolder },
  { id: 'upload', label: 'Archive File',   Icon: IconFile },
  { id: 'files',  label: 'HTML/CSS/JS',    Icon: IconCode },
]

const ANALYSIS_TOOLS = [
  { name: 'Semgrep',   type: 'SAST' },
  { name: 'Bandit',    type: 'Python' },
  { name: 'pip-audit', type: 'Deps' },
  { name: 'GitLeaks',  type: 'Secrets' },
]

const AI_PROVIDERS = [
  { id: 'ollama', name: 'Ollama (Local)' },
  { id: 'claude', name: 'Anthropic Claude' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI GPT' },
]

function isValidGithubUrl(url) {
  try {
    const u = new URL(url)
    return u.hostname === 'github.com' && u.pathname.split('/').filter(Boolean).length >= 2
  } catch { return false }
}

// ─── Mini File-Link Preview Diagram ───────────────────────────────────────────
function FileLinkPreview({ files }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || files.length === 0) return
    const el = svgRef.current
    const W = el.clientWidth || 480
    const H = 120

    // Clear
    while (el.firstChild) el.removeChild(el.firstChild)
    el.setAttribute('viewBox', `0 0 ${W} ${H}`)

    const ns = 'http://www.w3.org/2000/svg'

    const fileColors = { html: '#EA580C', css: '#0EA5E9', js: '#D97706', ts: '#0284C7' }
    const fileSpacing = Math.min(140, (W - 60) / Math.max(files.length - 1, 1))
    const startX = (W - (files.length - 1) * fileSpacing) / 2

    // Draw threads between files
    files.forEach((file, i) => {
      if (i === 0) return
      const x1 = startX + (i - 1) * fileSpacing
      const x2 = startX + i * fileSpacing
      const y = 55

      // Detect vulnerability type based on file extension
      const prevExt = files[i - 1].name.split('.').pop().toLowerCase()
      const currExt = file.name.split('.').pop().toLowerCase()
      const isAttack = file.hasVuln || files[i - 1].hasVuln

      // Thread line
      const line = document.createElementNS(ns, 'line')
      line.setAttribute('x1', x1 + 28)
      line.setAttribute('y1', y)
      line.setAttribute('x2', x2 - 28)
      line.setAttribute('y2', y)
      line.setAttribute('stroke', isAttack ? '#EF4444' : '#BAE6FD')
      line.setAttribute('stroke-width', isAttack ? '2' : '1.5')
      line.setAttribute('stroke-dasharray', '5 4')
      el.appendChild(line)

      // Animate a style for the dashes
      const anim = document.createElementNS(ns, 'animateTransform')
      // Use a traveling dot instead
      const dot = document.createElementNS(ns, 'circle')
      dot.setAttribute('r', '4')
      dot.setAttribute('fill', isAttack ? '#EF4444' : '#0EA5E9')
      dot.setAttribute('opacity', '0.9')
      if (isAttack) {
        dot.setAttribute('filter', 'drop-shadow(0 0 4px #EF4444)')
      }
      el.appendChild(dot)

      // Animate the dot along the line
      const animMotion = document.createElementNS(ns, 'animateMotion')
      animMotion.setAttribute('dur', isAttack ? '1.2s' : '2s')
      animMotion.setAttribute('repeatCount', 'indefinite')
      animMotion.setAttribute('calcMode', 'linear')

      const mpath = document.createElementNS(ns, 'mpath')
      const pathEl = document.createElementNS(ns, 'path')
      const pathId = `thread-path-${i}`
      pathEl.setAttribute('id', pathId)
      pathEl.setAttribute('d', `M${x1 + 28},${y} L${x2 - 28},${y}`)
      pathEl.setAttribute('fill', 'none')
      pathEl.setAttribute('stroke', 'none')
      el.appendChild(pathEl)
      mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${pathId}`)
      animMotion.appendChild(mpath)
      dot.appendChild(animMotion)
    })

    // Draw file nodes
    files.forEach((file, i) => {
      const x = startX + i * fileSpacing
      const y = 55
      const ext = file.name.split('.').pop().toLowerCase()
      const color = fileColors[ext] || '#64748B'

      // Node circle
      const circle = document.createElementNS(ns, 'circle')
      circle.setAttribute('cx', x)
      circle.setAttribute('cy', y)
      circle.setAttribute('r', '26')
      circle.setAttribute('fill', 'white')
      circle.setAttribute('stroke', file.hasVuln ? '#EF4444' : color)
      circle.setAttribute('stroke-width', file.hasVuln ? '2.5' : '1.5')
      if (file.hasVuln) {
        circle.setAttribute('filter', 'drop-shadow(0 0 6px rgba(239,68,68,0.4))')
      }
      el.appendChild(circle)

      // Extension label
      const text = document.createElementNS(ns, 'text')
      text.setAttribute('x', x)
      text.setAttribute('y', y + 5)
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('fill', file.hasVuln ? '#EF4444' : color)
      text.setAttribute('font-size', '11')
      text.setAttribute('font-weight', '700')
      text.setAttribute('font-family', 'JetBrains Mono, monospace')
      text.textContent = `.${ext}`
      el.appendChild(text)

      // Filename below
      const label = document.createElementNS(ns, 'text')
      label.setAttribute('x', x)
      label.setAttribute('y', y + 46)
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('fill', '#64748B')
      label.setAttribute('font-size', '9')
      label.setAttribute('font-family', 'Inter, sans-serif')
      label.textContent = file.name.length > 12 ? file.name.slice(0, 12) + '…' : file.name
      el.appendChild(label)

      // Vuln badge
      if (file.hasVuln) {
        const badge = document.createElementNS(ns, 'rect')
        badge.setAttribute('x', x + 16)
        badge.setAttribute('y', y - 38)
        badge.setAttribute('width', 32)
        badge.setAttribute('height', 14)
        badge.setAttribute('rx', '4')
        badge.setAttribute('fill', '#EF4444')
        el.appendChild(badge)
        const badgeTxt = document.createElementNS(ns, 'text')
        badgeTxt.setAttribute('x', x + 32)
        badgeTxt.setAttribute('y', y - 28)
        badgeTxt.setAttribute('text-anchor', 'middle')
        badgeTxt.setAttribute('fill', 'white')
        badgeTxt.setAttribute('font-size', '7')
        badgeTxt.setAttribute('font-weight', '700')
        badgeTxt.setAttribute('font-family', 'Inter, sans-serif')
        badgeTxt.textContent = 'VULN'
        el.appendChild(badgeTxt)
      }
    })
  }, [files])

  if (files.length === 0) return null

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-3)',
      marginTop: 'var(--space-3)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconLink />
        File relationship preview — threads show data flow; red = potential vulnerability path
      </div>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: 120, overflow: 'visible' }}
      />
    </div>
  )
}

export default function Analyzer() {
  const navigate = useNavigate()
  const [mode, setMode]           = useState('url')
  const [url, setUrl]             = useState('')
  const [localPath, setLocalPath] = useState('')
  const [archivePath, setArchivePath] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([])   // [{name, hasVuln}]
  const [models, setModels]       = useState([])
  const [engineConfig, setEngineConfig] = useState({ provider: 'ollama', model: 'unknown' })
  const [selectedModel, setSelectedModel] = useState('')
  const [dragging, setDragging]   = useState(false)
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ollamaOffline, setOllamaOffline] = useState(false)
  const [startingOllama, setStartingOllama] = useState(false)
  const [systemTools, setSystemTools] = useState([])
  const dropRef = useRef(null)

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const confRes = await fetch(`${BACKEND}/api/config/status`)
        const conf = await confRes.json()
        setEngineConfig(conf)

        if (conf.provider === 'ollama') {
          const info = await window.acm.checkOllama()
          setOllamaOffline(!info.running)
          const names = (info.models || []).map(m => m.name)
          setModels(names)
          if (names.length > 0) setSelectedModel(names[0])
        } else {
          setSelectedModel(conf.model)
        }
      } catch (e) {
        console.warn(e)
      }

      // Fetch system tools
      try {
        const res = await fetch(`${BACKEND}/api/system/tools`)
        const data = await res.json()
        setSystemTools(data.tools || [])
      } catch {}
    }
    fetchInfo()
  }, [])

  const handlePickFolder = async () => {
    const path = await window.acm.openDirectory()
    if (path) setLocalPath(path)
  }

  const handlePickFile = async () => {
    const path = await window.acm.openFile()
    if (path) setArchivePath(path)
  }

  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    const webFiles = droppedFiles
      .filter(f => /\.(html|css|js|ts|jsx|tsx|java|cs|go)$/.test(f.name))
      .map(f => ({ name: f.name, path: f.path, hasVuln: false }))
    setUploadedFiles(prev => {
      const all = [...prev, ...webFiles]
      // Deduplicate by name
      return all.filter((f, i, arr) => arr.findIndex(x => x.name === f.name) === i)
    })
  }

  const handleStartOllama = async () => {
    setStartingOllama(true)
    await window.acm.startOllama()
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const info = await window.acm.checkOllama()
      if (info.running || attempts >= 8) {
        clearInterval(poll)
        setStartingOllama(false)
        if (info.running) {
          setOllamaOffline(false)
          const names = (info.models || []).map(m => m.name)
          setModels(names)
          if (names.length > 0) setSelectedModel(names[0])
        }
      }
    }, 1000)
  }

  const validate = () => {
    if (mode === 'url') {
      if (!url.trim()) return 'Enter a GitHub repository URL.'
      if (!isValidGithubUrl(url.trim())) return 'URL must point to a GitHub repository (github.com/owner/repo).'
    }
    if (mode === 'local'  && !localPath)   return 'Select a local repository folder.'
    if (mode === 'upload' && !archivePath) return 'Select an archive file (.zip, .tar.gz).'
    if (mode === 'files'  && uploadedFiles.length === 0) return 'Add at least one HTML, CSS, or JS file.'
    if (engineConfig.provider === 'ollama' && !selectedModel && !ollamaOffline)
      return 'No Ollama model available. Ensure Ollama is running.'
    return ''
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSubmitting(true)

    let repoUrl
    if (mode === 'url')    repoUrl = url.trim()
    else if (mode === 'local')  repoUrl = `file://${localPath}`
    else if (mode === 'upload') repoUrl = `file://${archivePath}`
    else if (mode === 'files')  repoUrl = `file://${uploadedFiles[0]?.path}`

    try {
      const res = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl,
          model: selectedModel || engineConfig.model,
          provider: engineConfig.provider,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || `Error ${res.status}: The analysis engine returned an error. Check that Ollama is running and a model is selected.`)
        setSubmitting(false)
        return
      }
      const { run_id } = await res.json()
      navigate(`/results/${run_id}`)
    } catch (e) {
      setError('Cannot connect to the analysis engine. Ensure the backend is running on port 8000.')
      setSubmitting(false)
    }
  }

  const installedTools = systemTools.filter(t => t.installed)

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-header">
        <div className="page-title">Analyze Repository</div>
        <div className="page-subtitle">
          Security analysis runs locally. No data leaves your machine (unless Cloud AI is selected).
        </div>
      </div>

      {/* Tools badge row */}
      {installedTools.length > 0 && (
        <div className="tools-panel mb-6">
          {ANALYSIS_TOOLS.map(tool => {
            const installed = installedTools.some(t => t.name === tool.name)
            return (
              <div key={tool.name} className={`tool-chip ${installed ? 'active' : ''}`}>
                <span className="tool-chip-dot" />
                {tool.name}
                <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>{tool.type}</span>
              </div>
            )
          })}
          {AI_PROVIDERS.map(p => (
            <div key={p.id} className={`tool-chip ${engineConfig.provider === p.id ? 'active' : ''}`}>
              <span className="tool-chip-dot" />
              {p.name}
            </div>
          ))}
        </div>
      )}

      {/* Source selector */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="card-title">Source</div>
        </div>

        <div className="tab-bar mb-6">
          {INPUT_MODES.map((m) => (
            <button
              key={m.id}
              className={`tab-item ${mode === m.id ? 'active' : ''}`}
              onClick={() => { setMode(m.id); setError('') }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <m.Icon />
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'url' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">GitHub Repository URL</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://github.com/owner/repository"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Supports public GitHub repos. For private repos, use Local Folder mode.
            </div>
          </div>
        )}

        {mode === 'local' && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Local Repository Path</label>
            <div className="flex gap-2">
              <input
                className="form-input"
                type="text"
                placeholder="Click Browse to select folder..."
                value={localPath}
                readOnly
              />
              <button className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={handlePickFolder}>
                Browse
              </button>
            </div>
          </div>
        )}

        {mode === 'upload' && (
          <div
            ref={dropRef}
            className={`drop-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const p = e.dataTransfer.files[0]?.path; if (p) setArchivePath(p) }}
            onClick={handlePickFile}
          >
            <div className="drop-zone-title">
              {archivePath ? archivePath.split(/[\\/]/).pop() : 'Drop archive here or click to browse'}
            </div>
            <div className="drop-zone-subtitle">Supported: .zip, .tar, .tar.gz</div>
          </div>
        )}

        {mode === 'files' && (
          <div>
            <div
              className={`drop-zone ${dragging ? 'dragging' : ''}`}
              style={{ marginBottom: 'var(--space-3)' }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={async () => {
                const path = await window.acm.openFile()
                if (path) {
                  const name = path.split(/[\\/]/).pop()
                  if (/\.(html|css|js|ts|jsx|tsx)$/.test(name)) {
                    setUploadedFiles(prev => {
                      const filtered = prev.filter(f => f.name !== name)
                      return [...filtered, { name, path, hasVuln: false }]
                    })
                  }
                }
              }}
            >
              <div className="drop-zone-title">
                Drop Source Code files here
              </div>
              <div className="drop-zone-subtitle">Supports .html, .css, .js, .ts, .java, .cs, .go — linked files show thread visualization</div>
            </div>

            {uploadedFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {uploadedFiles.map((file, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--surface-raised)',
                    border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <IconCode />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{file.name}</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--critical)', padding: '2px 6px' }}
                      onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <FileLinkPreview files={uploadedFiles} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Engine */}
      <div className="card mb-6">
        <div className="card-header" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCpu />
              AI Engine
            </span>
          </div>
          <div className="card-subtitle" style={{ textTransform: 'capitalize' }}>
            {engineConfig.provider === 'ollama' ? 'Local Ollama Inference' : `Cloud API (${engineConfig.provider})`}
          </div>
        </div>

        {ollamaOffline && engineConfig.provider === 'ollama' && (
          <div className="alert alert-critical mb-4" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconShield />
              <span>Ollama is not running. Start it to use local AI models.</span>
            </div>
            <button
              className="btn btn-sm btn-success"
              onClick={handleStartOllama}
              disabled={startingOllama}
              style={{ flexShrink: 0 }}
            >
              {startingOllama ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Starting...</> : <><IconPlay /> Start Ollama</>}
            </button>
          </div>
        )}

        {engineConfig.provider !== 'ollama' ? (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Configured Model</label>
            <input className="form-input text-mono" value={engineConfig.model} readOnly disabled />
          </div>
        ) : models.length === 0 && !ollamaOffline ? (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--medium-dim)', border: '1px solid var(--medium-border)',
            borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--medium)',
          }}>
            No models installed. Run{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>ollama pull qwen2.5-coder:3b</code>
            {' '}in your terminal, then refresh.
          </div>
        ) : models.length > 0 ? (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select model for this run</label>
            <select
              className="form-input form-select text-mono"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {/* Security notice */}
      <div className="alert alert-success mb-6">
        <IconShield />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          AES-256-GCM — results encrypted in memory only, never written to disk in plaintext. Session cleared on close.
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-critical mb-4">
          <IconShield />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Cancel
        </button>
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}>
          {submitting
            ? <><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />Starting analysis...</>
            : 'Begin Analysis'}
        </button>
      </div>
    </div>
  )
}
