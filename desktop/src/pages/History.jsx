import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://127.0.0.1:8000'

export default function History() {
  const navigate = useNavigate()
  const [runs, setRuns]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${BACKEND}/api/runs`)
      .then(r => r.json())
      .then(data => { setRuns(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Scan History</div>
        <div className="page-subtitle">All analysis runs performed on this machine</div>
      </div>

      {loading ? (
        <div className="text-muted text-sm">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
          <div className="text-muted text-sm">
            No scan history. Run your first analysis from the Analyze page.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Repository</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="text-mono text-xs text-muted">#{run.id}</td>
                  <td>
                    <span className="inline-code">
                      {run.repo_url.replace('https://github.com/', '')}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      run.status === 'done'  ? 'badge-safe'     :
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
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
