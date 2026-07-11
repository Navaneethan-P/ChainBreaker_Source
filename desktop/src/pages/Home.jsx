import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://127.0.0.1:8000'

export default function Home() {
  const navigate = useNavigate()
  const [recentRuns, setRecentRuns] = useState([])
  const [ollamaInfo, setOllamaInfo] = useState({ running: false, models: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const [runsRes, ollama] = await Promise.all([
          fetch(`${BACKEND}/api/runs`).then(r => r.json()).catch(() => []),
          window.acm.checkOllama(),
        ])
        setRecentRuns(runsRes.slice(0, 5))
        setOllamaInfo(ollama)
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
            <div className={`stat-value ${ollamaInfo.running ? 'safe' : 'critical'}`}>
              {ollamaInfo.running ? 'Active' : 'Offline'}
            </div>
            <div className="stat-label">Ollama Status</div>
          </div>
        </div>
        <div className="card card-sm">
          <div className="stat-block">
            <div className="stat-value accent">{ollamaInfo.models.length}</div>
            <div className="stat-label">Models Available</div>
          </div>
        </div>
      </div>

      {/* Primary action */}
      <div className="card mb-8" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-dim)' }}>
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

      {/* Model info */}
      {ollamaInfo.models.length > 0 && (
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
    </div>
  )
}
