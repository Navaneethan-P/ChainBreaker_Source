import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://127.0.0.1:8000'
const STUCK_MS = 5 * 60 * 1000

// ─── Icons ─────────────────────────────────────────────────────────────────────
const IconScan = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 16, height: 16 }}>
    <path d="M6 2H3a1 1 0 00-1 1v3M6 14H3a1 1 0 01-1-1v-3M10 2h3a1 1 0 011 1v3M10 14h3a1 1 0 001-1v-3M5 8h6"/>
  </svg>
)
const IconHistory = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 16, height: 16 }}>
    <circle cx="8" cy="8" r="6"/>
    <path d="M8 5v3.5l2.5 1.5"/>
  </svg>
)
const IconSettings = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
  </svg>
)
const IconShield = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
    <path d="M8 1L2 3.5v4C2 11 5 13.5 8 15c3-1.5 6-4 6-7.5v-4L8 1z"/>
  </svg>
)
const IconCpu = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
    <rect x="4" y="4" width="8" height="8" rx="1"/>
    <path d="M6 1v3M10 1v3M6 12v3M10 12v3M1 6h3M1 10h3M12 6h3M12 10h3"/>
  </svg>
)
const IconWarning = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13, flexShrink: 0 }}>
    <path d="M7 1L13 12H1L7 1z"/>
    <path d="M7 5v3.5M7 10.5v.5"/>
  </svg>
)
const IconPlay = () => (
  <svg viewBox="0 0 12 12" fill="currentColor" style={{ width: 11, height: 11 }}>
    <polygon points="2,1 10,6 2,11"/>
  </svg>
)
const IconThreat = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13 }}>
    <circle cx="8" cy="8" r="6"/>
    <path d="M8 5v3M8 10.5v.5"/>
  </svg>
)

const ANALYSIS_TOOLS = [
  { name: 'Semgrep', tag: 'SAST' },
  { name: 'Bandit', tag: 'Python' },
  { name: 'pip-audit', tag: 'Deps' },
  { name: 'npm-audit', tag: 'Node.js' },
  { name: 'GitLeaks', tag: 'Secrets' },
]

const THREAT_FEED = [
  { id: 1, cve: 'CVE-2026-1029', desc: 'Critical RCE in popular JS framework', time: '2m ago', severity: 'CRITICAL' },
  { id: 2, cve: 'CVE-2026-0992', desc: 'Auth bypass in SSH daemon', time: '14m ago', severity: 'HIGH' },
  { id: 3, cve: 'CVE-2026-1104', desc: 'Zero-day exploit chain detected in wild', time: '1h ago', severity: 'CRITICAL' },
]

const STATUS_CONFIG = {
  done:     { label: 'Done',     badge: 'badge-safe' },
  error:    { label: 'Error',    badge: 'badge-critical' },
  pending:  { label: 'Pending',  badge: 'badge-info' },
  scanning: { label: 'Scanning', badge: 'badge-info' },
  graphing: { label: 'Graphing', badge: 'badge-info' },
  reasoning:{ label: 'Reasoning',badge: 'badge-info' },
}

export default function Home() {
  const navigate = useNavigate()
  const [recentRuns, setRecentRuns]     = useState([])
  const [engineConfig, setEngineConfig] = useState({ provider: 'ollama', model: '', has_key: false })
  const [ollamaInfo, setOllamaInfo]     = useState({ running: false, models: [] })
  const [loading, setLoading]           = useState(true)
  const [startingOllama, setStartingOllama] = useState(false)
  const [threatFeed, setThreatFeed]     = useState(THREAT_FEED)

  useEffect(() => {
    const init = async () => {
      try {
        const [runsRes, ollama, configRes, intelRes] = await Promise.all([
          fetch(`${BACKEND}/api/runs`).then(r => r.json()).catch(() => []),
          window.acm.checkOllama(),
          fetch(`${BACKEND}/api/config/status`).then(r => r.json()).catch(() => ({ provider: 'ollama', model: '', has_key: false })),
          fetch(`${BACKEND}/api/threat-intel`).then(r => r.json()).catch(() => []),
        ])
        setRecentRuns(runsRes.slice(0, 5))
        setOllamaInfo(ollama)
        setEngineConfig(configRes)
        if (intelRes && intelRes.length > 0) {
          const mapped = intelRes.slice(0, 5).map((t, idx) => ({
            id: t.id || `dyn-${idx}`,
            cve: `ID-${t.topology_hash.slice(0,8).toUpperCase()}`,
            desc: t.nodes && t.nodes.length > 0 ? `Attack chain involving ${t.nodes[0].weakness || 'vulnerability'}` : 'Anonymous attack pattern',
            time: new Date(t.published_at).toLocaleDateString(),
            severity: (t.impact_level || 'HIGH').toUpperCase()
          }))
          setThreatFeed(mapped)
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const completed       = recentRuns.filter(r => r.status === 'done').length
  const total           = recentRuns.length
  const cloudWithNoKey  = engineConfig.provider !== 'ollama' && !engineConfig.has_key
  const ollamaOffline   = engineConfig.provider === 'ollama' && !ollamaInfo.running && !loading

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
        if (info.running) setOllamaInfo(info)
      }
    }, 1000)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">
          {engineConfig.provider === 'ollama'
            ? 'Local AI mode — no data leaves this machine'
            : `Cloud AI (${engineConfig.provider}) — code snippets sent to provider`}
        </div>
      </div>

      {/* Cloud warning */}
      {cloudWithNoKey && (
        <div className="alert alert-critical mb-6" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconWarning />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Cloud engine selected but no API key configured</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Scans will fail. Configure an API key or switch to Local (Ollama).</div>
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => navigate('/settings')}>Fix in Settings</button>
        </div>
      )}

      {/* AI Setup Warning */}
      {(ollamaOffline || (engineConfig.provider === 'ollama' && ollamaInfo.models.length === 0)) && !loading && (
        <div className="alert alert-critical mb-6" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconWarning />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>AI Engine Not Ready</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Ollama is offline or no models are installed. Analysis requires an AI engine.</div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-success"
            onClick={() => navigate('/setup')}
            style={{ gap: 5, flexShrink: 0 }}
          >
            Run Setup Wizard
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-icon"><IconHistory /></div>
          <div className="stat-card-value">{total}</div>
          <div className="stat-card-label">Total Scans</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><IconShield /></div>
          <div className="stat-card-value" style={{ color: 'var(--safe)' }}>{completed}</div>
          <div className="stat-card-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><IconCpu /></div>
          <div className="stat-card-value" style={{ fontSize: 16, lineHeight: '1.6' }}>
            {engineConfig.provider === 'ollama' ? 'Local' : 'Cloud'}
          </div>
          <div className="stat-card-label">AI Engine</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><IconScan /></div>
          <div className="stat-card-value" style={{ fontSize: 13, lineHeight: '2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
            {engineConfig.model || 'Not set'}
          </div>
          <div className="stat-card-label">Active Model</div>
        </div>
      </div>

      {/* Achievements / Gamification */}
      <div className="card mb-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--surface-border)' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          🏅 Security Champion Achievements
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ minWidth: 200, padding: 12, background: 'var(--safe-dim)', border: '1px solid var(--safe-border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--safe)' }}>First Blood</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Remediated an attack chain</div>
            </div>
          </div>
          <div style={{ minWidth: 200, padding: 12, background: 'var(--primary-dim)', border: '1px solid var(--primary-border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>🎓</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--primary-light)' }}>Threat Scholar</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Used ELI5 mode 5 times</div>
            </div>
          </div>
          <div style={{ minWidth: 200, padding: 12, background: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.6 }}>
            <span style={{ fontSize: 24, filter: 'grayscale(100%)' }}>👑</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Zero Trust King</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Achieve 0 Critical Findings</div>
            </div>
          </div>
          <div style={{ minWidth: 200, padding: 12, background: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.6 }}>
            <span style={{ fontSize: 24, filter: 'grayscale(100%)' }}>🔥</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Chaos Agent</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Inject Chaos 3 times</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions + engine */}
      <div className="flex gap-4 mb-6">
        {/* Primary CTA */}
        <div className="card" style={{ 
          flex: 2, 
          borderColor: 'var(--primary-border)', 
          background: 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(2,132,199,0.2) 100%)',
          boxShadow: '0 0 30px rgba(14,165,233,0.15), inset 0 1px 1px rgba(255,255,255,0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow */}
          <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'var(--primary)', filter: 'blur(80px)', opacity: 0.3, borderRadius: '50%' }} />
          
          <div className="flex items-center justify-between" style={{ position: 'relative', zIndex: 10 }}>
            <div>
              <div className="card-title" style={{ color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
                <IconScan /> Scan a Repository
              </div>
              <div className="card-subtitle" style={{ color: 'var(--text-secondary)' }}>
                Paste a GitHub repository link to find attack chains
              </div>
            </div>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/analyze')}
              style={{ flexShrink: 0, boxShadow: '0 0 15px rgba(14,165,233,0.4)' }}
              disabled={cloudWithNoKey}
            >
              Start Analysis
            </button>
          </div>
        </div>

        {/* Engine quick-access */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconSettings />
            Engine Config
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {engineConfig.provider === 'ollama'
              ? `Local — ${ollamaInfo.running ? `${ollamaInfo.models.length} model(s) loaded` : 'Ollama offline'}`
              : `${engineConfig.provider} — ${engineConfig.has_key ? 'Key configured' : 'No API key'}`}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')}>
            Open Settings
          </button>
        </div>
      </div>

      {/* Tools panel */}
      <div className="card mb-6">
        <div className="card-header" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-title">Analysis Tools</div>
          <span className="badge badge-primary">Active</span>
        </div>
        <div className="tools-panel" style={{ background: 'var(--surface-raised)', border: 'none', padding: 0 }}>
          {ANALYSIS_TOOLS.map(tool => (
            <div key={tool.name} className="tool-chip active">
              <span className="tool-chip-dot" />
              {tool.name}
              <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>{tool.tag}</span>
            </div>
          ))}
          {['Ollama', 'Claude', 'Gemini', 'OpenAI'].map(name => (
            <div key={name} className={`tool-chip ${engineConfig.provider === name.toLowerCase() || (name === 'Ollama' && engineConfig.provider === 'ollama') ? 'active' : ''}`}>
              <span className="tool-chip-dot" />
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Ollama loaded models */}
      {engineConfig.provider === 'ollama' && ollamaInfo.running && ollamaInfo.models.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <div>
              <div className="card-title">Loaded Models</div>
              <div className="card-subtitle">Available for local inference via Ollama</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {ollamaInfo.models.map((m) => {
              const name = typeof m === 'string' ? m : m.name
              return (
                <div key={name} className="flex items-center justify-between" style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--surface-border)',
                }}>
                  <span className="text-mono text-sm">{name}</span>
                  <span className="badge badge-safe">Ready</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent scans */}
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Scans</div>
            <div className="card-subtitle">Last five analysis runs</div>
          </div>
          {total > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
              View all
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            <span className="spinner" />
            Loading...
          </div>
        ) : recentRuns.length === 0 ? (
          <div style={{
            padding: 'var(--space-10)', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 13,
          }}>
            No scans yet. Run your first analysis to see results here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentRuns.map((run) => {
              const isStuck = run.status === 'pending' && (Date.now() - new Date(run.created_at).getTime()) > STUCK_MS
              const cfg = STATUS_CONFIG[run.status] || { label: run.status, badge: 'badge-info' }
              const repoName = run.repo_url.replace(/^https?:\/\/github\.com\//, '').replace(/^file:\/\//, '').split('/').slice(-2).join('/')
              return (
                <div
                  key={run.id}
                  className="history-item"
                  onClick={() => navigate(`/results/${run.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="text-mono text-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {repoName}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                    {isStuck && <span style={{ fontSize: 10, color: 'var(--medium)' }}>Possibly stuck</span>}
                  </div>
                  <span className="text-xs text-muted text-mono" style={{ flexShrink: 0 }}>
                    {new Date(run.created_at).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Enterprise Integrations */}
      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">Enterprise Workspaces</div>
            <div className="card-subtitle">RBAC & CI/CD Integrations (Preview)</div>
          </div>
          <span className="badge badge-primary">Coming Soon</span>
        </div>
        <div className="flex gap-4">
          <div style={{
            flex: 1, padding: 'var(--space-4)',
            background: 'var(--surface-raised)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 6
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Team Synchronization</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Role-Based Access Control (RBAC) to share attack chain reports securely across a centralized internal dashboard.
            </div>
            <button className="btn btn-sm btn-ghost mt-2" disabled style={{ alignSelf: 'flex-start' }}>Configure Teams</button>
          </div>
          <div style={{
            flex: 1, padding: 'var(--space-4)',
            background: 'var(--surface-raised)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 6
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>CI/CD Pipeline Export</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Headless integration via GitHub Actions or Jenkins to block vulnerable pull requests automatically.
            </div>
            <button className="btn btn-sm mt-2" disabled style={{ alignSelf: 'flex-start', background: 'var(--surface-active)' }}>Generate Script</button>
          </div>
        </div>
      </div>

      {/* Threat intelligence feed */}
      <div className="card" style={{ borderColor: 'var(--primary-border)' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconThreat style={{ color: 'var(--primary)' }} />
              Threat Intelligence Feed
            </div>
            <div className="card-subtitle">Global zero-day and vulnerability monitoring</div>
          </div>
          <span className="badge badge-primary" style={{ animation: 'pulseNode 2s infinite' }}>LIVE</span>
        </div>
        <div className="flex flex-col gap-3">
          {threatFeed.map(t => (
            <div key={t.id} className="flex items-center justify-between" style={{
              borderLeft: `3px solid ${t.severity === 'CRITICAL' ? 'var(--critical)' : 'var(--high)'}`,
              paddingLeft: 12,
            }}>
              <div>
                <div style={{
                  color: t.severity === 'CRITICAL' ? 'var(--critical)' : 'var(--high)',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, marginBottom: 2
                }}>
                  {t.cve}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                <span className={`badge ${t.severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>{t.severity}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{t.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
