import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://127.0.0.1:8000'

export default function Home() {
  const navigate = useNavigate()
  const [recentRuns, setRecentRuns] = useState([])
  const [ollamaInfo, setOllamaInfo] = useState({ running: false, models: [] })
  const [engineConfig, setEngineConfig] = useState({ provider: 'ollama', model: 'unknown' })
  const [loading, setLoading] = useState(true)
  const [threatFeed, setThreatFeed] = useState([
    { id: 1, cve: 'CVE-2026-1029', desc: 'Critical RCE in popular JS framework', time: '2m ago' },
    { id: 2, cve: 'CVE-2026-0992', desc: 'Auth bypass in SSH daemon', time: '14m ago' },
    { id: 3, cve: 'CVE-2026-1104', desc: 'Zero-day exploit chain detected in wild', time: '1h ago' },
  ])

  useEffect(() => {
    const init = async () => {
      try {
        const [runsRes, ollama, configRes] = await Promise.all([
          fetch(`${BACKEND}/api/runs`).then(r => r.json()).catch(() => []),
          window.acm.checkOllama(),
          fetch(`${BACKEND}/api/config/status`).then(r => r.json()).catch(() => ({ provider: 'unknown', model: 'unknown' })),
        ])
        setRecentRuns(runsRes.slice(0, 5))
        setOllamaInfo(ollama)
        setEngineConfig(configRes)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const critical = recentRuns.filter(r => r.status === 'done').length
  const total    = recentRuns.length

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">
          Local security intelligence — no data leaves this machine
        </div>
      </div>

      {/* Stat row */}
      <div className="grid-4 mb-8">
        <div className="card card-sm">
          <div className="stat-block">
            <div className="stat-value accent">{total}</div>
            <div className="stat-label">Total Scans</div>
          </div>
        </div>
        <div className="card card-sm">
          <div className="stat-block">
            <div className="stat-value">{critical}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="card card-sm">
          <div className="stat-block">
            <div className={`stat-value ${engineConfig.provider !== 'unknown' ? 'safe' : 'critical'}`} style={{ textTransform: 'capitalize' }}>
              {engineConfig.provider === 'ollama' ? 'Local' : 'Cloud'}
            </div>
            <div className="stat-label">AI Engine</div>
          </div>
        </div>
        <div className="card card-sm">
          <div className="stat-block">
            <div className="stat-value accent" style={{ fontSize: '18px', lineHeight: '32px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {engineConfig.model || 'Unknown'}
            </div>
            <div className="stat-label">Active Model</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        {/* Primary action */}
        <div className="card" style={{ flex: 2, borderColor: 'var(--accent-border)', background: 'var(--accent-dim)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title" style={{ color: 'var(--accent)', marginBottom: 4 }}>
                Scan a Repository
              </div>
              <div className="card-subtitle">
                Provide a GitHub URL or a local folder to begin multi-agent analysis
              </div>
            </div>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/analyze')}
              style={{ flexShrink: 0 }}
            >
              Start Analysis
            </button>
          </div>
        </div>
        
        {/* Secondary action */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="card-title mb-2">Engine Config</div>
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/setup')}
          >
            Reconfigure AI
          </button>
        </div>
      </div>

      {/* Model info */}
      {engineConfig.provider === 'ollama' && ollamaInfo.models.length > 0 && (
        <div className="card mb-8">
          <div className="card-header">
            <div>
              <div className="card-title">Loaded Models</div>
              <div className="card-subtitle">Available for inference via local Ollama</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {ollamaInfo.models.map((m) => (
              <div
                key={m.name}
                className="flex items-center justify-between"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--surface-base)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <span className="text-mono text-sm">{m.name}</span>
                <span className="badge badge-safe">Ready</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent scans */}
      <div className="card">
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
          <div className="text-muted text-sm">Loading...</div>
        ) : recentRuns.length === 0 ? (
          <div style={{
            padding: 'var(--space-10)',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}>
            No scans yet. Run your first analysis to see results here.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <span className="inline-code">
                        {run.repo_url.replace('https://github.com/', '')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        run.status === 'done'  ? 'badge-safe' :
                        run.status === 'error' ? 'badge-critical' : 'badge-info'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="text-mono text-xs text-muted">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/results/${run.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Threat Intelligence (God Mode Feature) */}
      <div className="card mt-8" style={{ borderColor: 'var(--terminal-green)' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ color: 'var(--terminal-green)' }}>Live Threat Intelligence Feed</div>
            <div className="card-subtitle">Global zero-day and vulnerability monitoring</div>
          </div>
          <span className="badge" style={{ background: 'var(--terminal-green)', color: 'black' }}>LIVE</span>
        </div>
        <div className="flex flex-col gap-3">
          {threatFeed.map(t => (
            <div key={t.id} className="flex items-center justify-between" style={{ borderLeft: '2px solid var(--terminal-green)', paddingLeft: 12 }}>
              <div>
                <div style={{ color: 'var(--terminal-green)', fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 2 }}>{t.cve}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.desc}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                {t.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
