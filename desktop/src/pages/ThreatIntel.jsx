import React, { useState, useEffect } from 'react'

const BACKEND = 'http://127.0.0.1:8000'

export default function ThreatIntel() {
  const [intel, setIntel] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchIntel = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/threat-intel`)
        const data = await res.json()
        setIntel(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchIntel()
  }, [])

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title">Global Threat Intel</div>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>Syncing nodes...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Global Threat Intel (Simulated P2P)</div>
        <div className="page-subtitle">
          Anonymized structural attack graphs shared across nodes. No PII or source code is leaked.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
        {intel.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No threat intel graphs published yet. Publish one from the Results page.
          </div>
        ) : (
          intel.map((item) => (
            <div key={item.id} className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${item.impact_level === 'Critical' ? 'badge-critical' : item.impact_level === 'High' ? 'badge-warning' : 'badge-safe'}`}>
                  {item.impact_level} Impact
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {new Date(item.published_at).toLocaleString()}
                </span>
              </div>
              
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Topology Hash:</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-void)', padding: 8, borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.topology_hash}
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <strong>{item.nodes.length}</strong> Nodes, <strong>{item.edges.length}</strong> Edges
              </div>
              
              <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Graph Preview (Anonymized):</div>
                <pre style={{ margin: 0, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 4 }}>
                  {item.edges.map(e => `${e.source.substring(0,6)} --[${e.action}]--> ${e.target.substring(0,6)}`).join('\n') || 'No edges'}
                </pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
