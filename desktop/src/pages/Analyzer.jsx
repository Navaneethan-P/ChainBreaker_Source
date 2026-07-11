import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://127.0.0.1:8000'

const INPUT_MODES = [
  { id: 'url',    label: 'GitHub URL' },
  { id: 'local',  label: 'Local Folder' },
  { id: 'upload', label: 'Archive File' },
]

function isValidGithubUrl(url) {
  try {
    const u = new URL(url)
    return u.hostname === 'github.com' && u.pathname.split('/').filter(Boolean).length >= 2
  } catch {
    return false
  }
}

export default function Analyzer() {
  const navigate    = useNavigate()
  const [mode, setMode]           = useState('url')
  const [url, setUrl]             = useState('')
  const [localPath, setLocalPath] = useState('')
  const [archivePath, setArchivePath] = useState('')
  const [models, setModels]       = useState([])
  const [engineConfig, setEngineConfig] = useState({ provider: 'ollama', model: 'unknown' })
  const [selectedModel, setSelectedModel] = useState('')
  const [dragging, setDragging]   = useState(false)
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const confRes = await fetch(`${BACKEND}/api/config/status`)
        const conf = await confRes.json()
        setEngineConfig(conf)
        
        if (conf.provider === 'ollama') {
          const info = await window.acm.checkOllama()
          const names = (info.models || []).map(m => m.name)
          setModels(names)
          if (names.length > 0) setSelectedModel(names[0])
        } else {
          setSelectedModel(conf.model)
        }
      } catch (e) {
        console.warn(e)
      }
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

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const path = e.dataTransfer.files[0]?.path
    if (path) setArchivePath(path)
  }

  const validate = () => {
    if (mode === 'url') {
      if (!url.trim()) return 'Enter a GitHub repository URL.'
      if (!isValidGithubUrl(url.trim())) return 'URL must point to a GitHub repository (github.com/owner/repo).'
    }
    if (mode === 'local' && !localPath) return 'Select a local repository folder.'
    if (mode === 'upload' && !archivePath) return 'Select an archive file (.zip, .tar.gz).'
    if (engineConfig.provider === 'ollama' && !selectedModel) return 'No Ollama model is available. Ensure Ollama is running.'
    return ''
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSubmitting(true)

    const repoUrl =
      mode === 'url'    ? url.trim()     :
      mode === 'local'  ? `file://${localPath}` :
      `file://${archivePath}`

    try {
      const res = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl, model: selectedModel }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || `Server error: ${res.status}`)
        setSubmitting(false)
        return
      }
      const { run_id } = await res.json()
      navigate(`/results/${run_id}`)
    } catch (e) {
      setError(`Could not connect to the analysis engine. Ensure the backend is running on port 8000.`)
      setSubmitting(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div className="page-title">Analyze Repository</div>
        <div className="page-subtitle">
          All analysis runs locally. No data is transmitted to external services.
        </div>
      </div>

      {/* Input mode selector */}
      <div className="card mb-6">
        <div className="card-header" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="card-title">Repository Source</div>
        </div>

        <div className="tab-bar mb-6">
          {INPUT_MODES.map((m) => (
            <button
              key={m.id}
              className={`tab-item ${mode === m.id ? 'active' : ''}`}
              onClick={() => { setMode(m.id); setError('') }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'url' && (
          <div className="form-group">
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
          </div>
        )}

        {mode === 'local' && (
          <div className="form-group">
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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handlePickFile}
          >
            <div className="drop-zone-title">
              {archivePath
                ? archivePath.split(/[\\/]/).pop()
                : 'Drop archive here or click to browse'}
            </div>
            <div className="drop-zone-subtitle">
              Supported formats: .zip, .tar, .tar.gz
            </div>
          </div>
        )}
      </div>

      {/* Model selector */}
      <div className="card mb-6">
        <div className="card-header" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-title">AI Engine</div>
          <div className="card-subtitle" style={{ textTransform: 'capitalize' }}>
            {engineConfig.provider === 'ollama' ? 'Local Ollama Inference' : `Cloud API (${engineConfig.provider})`}
          </div>
        </div>

        {engineConfig.provider !== 'ollama' ? (
          <div className="form-group">
            <label className="form-label">Configured Model</label>
            <input className="form-input text-mono" value={engineConfig.model} readOnly disabled />
          </div>
        ) : models.length === 0 ? (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--critical-dim)',
            border: '1px solid var(--critical-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            color: 'var(--critical)',
          }}>
            No models found. Ensure Ollama is running: <code style={{ fontFamily: 'var(--font-mono)' }}>ollama serve</code>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Select local model for this run</label>
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
        )}
      </div>

      {/* Encryption notice */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--safe-dim)',
        border: '1px solid var(--safe-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 12,
        color: 'var(--safe)',
        fontFamily: 'var(--font-mono)',
        marginBottom: 'var(--space-6)',
        lineHeight: 1.6,
      }}>
        AES-256-GCM — results are encrypted in memory only and never written to disk in plaintext.
        Session data is cleared on close.
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--critical-dim)',
          border: '1px solid var(--critical-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          color: 'var(--critical)',
          marginBottom: 'var(--space-4)',
        }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Starting analysis...' : 'Begin Analysis'}
        </button>
      </div>
    </div>
  )
}
