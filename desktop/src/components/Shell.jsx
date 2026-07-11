import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// ─── SVG Icons (no external icon library) ─────────────────────────────────────
const IconHome     = () => <svg className="nav-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 6.5L8 2l6 4.5V14H10v-3H6v3H2V6.5z"/></svg>
const IconScan     = () => <svg className="nav-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 8h6M8 5v6"/></svg>
const IconHistory  = () => <svg className="nav-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2.5 1.5"/></svg>
const IconLock     = () => <svg className="enc-indicator-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>

function SystemStatus() {
  const [ollamaOk, setOllamaOk]   = useState(null)
  const [backendOk, setBackendOk] = useState(null)

  useEffect(() => {
    const check = async () => {
      const [ollama, backend] = await Promise.all([
        window.acm.checkOllama(),
        window.acm.checkBackend(),
      ])
      setOllamaOk(ollama.running)
      setBackendOk(backend.running)
    }
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [])

  const statusClass = (ok) => ok === null ? 'pending' : ok ? 'online' : 'offline'
  const statusText  = (ok, label) =>
    ok === null ? `${label} checking` : ok ? `${label} ready` : `${label} offline`

  return (
    <div className="titlebar-status">
      <span className={`status-dot ${statusClass(backendOk)}`} title={statusText(backendOk, 'Engine')} />
      <span className="status-label">{statusText(backendOk, 'Engine')}</span>
      <span style={{ width: 12 }} />
      <span className={`status-dot ${statusClass(ollamaOk)}`} title={statusText(ollamaOk, 'Ollama')} />
      <span className="status-label">{statusText(ollamaOk, 'Ollama')}</span>
    </div>
  )
}

export default function Shell({ children }) {
  const location = useLocation()

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
          </div>

          <div className="sidebar-footer">
            <div className="enc-indicator mb-4">
              <IconLock />
              <span className="enc-indicator-text">AES-256-GCM LOCAL</span>
            </div>
            <div className="sidebar-footer-text">
              Attack Chain Mapper<br />
              Open Source — MIT License<br />
              <span
                style={{ cursor: 'pointer', color: 'var(--accent)' }}
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
