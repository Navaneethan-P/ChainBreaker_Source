import React, { useEffect, useState, useCallback } from 'react'
import { NavLink } from 'react-router-dom'

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconHome = () => (
  <svg className="nav-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 6.5L8 2l6 4.5V14H10v-3H6v3H2V6.5z"/>
  </svg>
)
const IconScan = () => (
  <svg className="nav-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 2H3a1 1 0 00-1 1v3M6 14H3a1 1 0 01-1-1v-3M10 2h3a1 1 0 011 1v3M10 14h3a1 1 0 001-1v-3M5 8h6"/>
  </svg>
)
const IconHistory = () => (
  <svg className="nav-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6"/>
    <path d="M8 5v3.5l2.5 1.5"/>
  </svg>
)
const IconSettings = () => (
  <svg className="nav-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
  </svg>
)
const IconNetwork = () => (
  <svg className="nav-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="7"/>
    <path d="M2 8h12M8 2c2 0 4 3 4 6s-2 6-4 6-4-3-4-6 2-6 4-6z"/>
  </svg>
)
const IconLock = () => (
  <svg className="enc-indicator-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="7" width="10" height="8" rx="1.5"/>
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>
  </svg>
)
const IconBackend = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 12, height: 12 }}>
    <rect x="1" y="1" width="12" height="5" rx="1"/>
    <rect x="1" y="8" width="12" height="5" rx="1"/>
    <circle cx="3.5" cy="3.5" r="0.75" fill="currentColor"/>
    <circle cx="3.5" cy="10.5" r="0.75" fill="currentColor"/>
  </svg>
)
const IconCpu = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 12, height: 12 }}>
    <rect x="3" y="3" width="8" height="8" rx="1"/>
    <path d="M5 1v2M9 1v2M5 11v2M9 11v2M1 5h2M1 9h2M11 5h2M11 9h2"/>
  </svg>
)
const IconPlay = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 11, height: 11 }}>
    <polygon points="3,2 11,7 3,12" fill="currentColor" stroke="none"/>
  </svg>
)

// ─── System Status Bar ─────────────────────────────────────────────────────────
function SystemStatus() {
  const [engineState, setEngineState] = useState({ provider: 'ollama', model: '', ok: null })
  const [backendOk, setBackendOk]     = useState(null)

  const check = useCallback(async () => {
    const backend = await window.acm.checkBackend()
    setBackendOk(backend.running)
    try {
      const res = await fetch('http://127.0.0.1:8000/api/config/status', { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const data = await res.json()
        if (data.provider === 'ollama') {
          const ollama = await window.acm.checkOllama()
          setEngineState({ provider: 'ollama', model: data.model || '', ok: ollama.running })
        } else {
          setEngineState({ provider: data.provider, model: data.model || '', ok: backend.running && !!data.has_key })
        }
      }
    } catch {
      setEngineState(prev => ({ ...prev, ok: false }))
    }
  }, [])

  useEffect(() => {
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [check])

  const statusClass = (ok) => ok === null ? 'pending' : ok ? 'online' : 'offline'

  const providerLabel = {
    ollama: 'Local AI',
    claude: 'Claude',
    gemini: 'Gemini',
    openai: 'OpenAI',
  }[engineState.provider] || 'Cloud AI'

  const engineText = engineState.ok === null
    ? `${providerLabel} — checking`
    : engineState.ok
      ? `${providerLabel} — ready`
      : `${providerLabel} — offline`

  const backendText = backendOk === null ? 'Backend checking' : backendOk ? 'Engine ready' : 'Engine offline'

  return (
    <div className="titlebar-status">
      <IconBackend />
      <span className={`status-dot ${statusClass(backendOk)}`} title={backendText} />
      <span className="status-label">{backendText}</span>
      <span style={{ width: 14 }} />
      <IconCpu />
      <span className={`status-dot ${statusClass(engineState.ok)}`} title={engineText} />
      <span className="status-label">{engineText}</span>
    </div>
  )
}

// ─── Ollama Footer Widget ─────────────────────────────────────────────────────
function OllamaWidget() {
  const [status, setStatus]   = useState(null)   // null | 'running' | 'offline'
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const check = async () => {
      const info = await window.acm.checkOllama()
      setStatus(info.running ? 'running' : 'offline')
    }
    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [])

  const handleStart = async () => {
    setStarting(true)
    await window.acm.startOllama()
    // Poll for 6 seconds
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const info = await window.acm.checkOllama()
      if (info.running || attempts >= 6) {
        clearInterval(poll)
        setStatus(info.running ? 'running' : 'offline')
        setStarting(false)
      }
    }, 1000)
  }

  if (status === null) return null

  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        background: status === 'running' ? 'var(--safe-dim)' : 'var(--critical-dim)',
        border: `1px solid ${status === 'running' ? 'var(--safe-border)' : 'var(--critical-border)'}`,
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`status-dot ${status === 'running' ? 'online' : 'offline'}`} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: status === 'running' ? 'var(--safe)' : 'var(--critical)' }}>
            Ollama {status === 'running' ? 'running' : 'offline'}
          </span>
        </div>
        {status === 'offline' && (
          <button
            className="btn btn-sm btn-success"
            style={{ padding: '2px 8px', fontSize: 10, gap: 4 }}
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> : <IconPlay />}
            {starting ? '' : 'Start'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────
export default function Shell({ children }) {
  return (
    <div className="app-shell">
      {/* Titlebar */}
      <div className="titlebar">
        <span className="titlebar-wordmark">Attack Chain Mapper</span>
        <SystemStatus />
      </div>

      <div className="app-body">
        {/* Sidebar */}
        <nav className="sidebar">
          <div className="nav-section">
            <div className="nav-section-label">Navigation</div>
            <NavLink to="/"        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
              <IconHome /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/analyze" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IconScan /><span>Analyze</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IconHistory /><span>History</span>
            </NavLink>
            <NavLink to="/threat-intel" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IconNetwork /><span>Threat Intel</span>
            </NavLink>
          </div>

          <div className="nav-section" style={{ marginBottom: 0 }}>
            <div className="nav-section-label">System</div>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IconSettings /><span>Settings</span>
            </NavLink>
          </div>

          <div className="sidebar-footer">
            <OllamaWidget />
            <div className="enc-indicator mb-3">
              <IconLock />
              <span className="enc-indicator-text">AES-256-GCM LOCAL</span>
            </div>
            <div className="sidebar-footer-text">
              Attack Chain Mapper<br />
              Open Source — MIT License<br />
              <span
                style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 500 }}
                onClick={() => window.acm.openExternal('https://github.com/Navaneethan-P/Forge')}
              >
                github.com/Navaneethan-P
              </span>
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  )
}
