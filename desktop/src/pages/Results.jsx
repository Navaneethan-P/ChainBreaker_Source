import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AttackGraph from '../components/AttackGraph'
import FixItPanel from '../components/FixItPanel'

const BACKEND = 'http://127.0.0.1:8000'

const STAGES = ['cloning', 'scanning', 'graphing', 'reasoning', 'scoring', 'deploying', 'done']
const STAGE_LABEL = {
  cloning:   'Cloning repository',
  scanning:  'Scanning for vulnerabilities',
  graphing:  'Building code graph',
  reasoning: 'Reasoning attack chains',
  scoring:   'Scoring impact',
  deploying: 'Generating report',
  done:      'Analysis complete',
  error:     'Analysis failed',
}

function ProgressStepper({ currentStage }) {
  const idx = STAGES.indexOf(currentStage)
  return (
    <div className="flex gap-0" style={{ marginBottom: 'var(--space-6)' }}>
      {STAGES.map((stage, i) => (
        <div
          key={stage}
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {/* connector */}
          {i < STAGES.length - 1 && (
            <div style={{
              position: 'absolute',
              top: 7,
              left: '50%',
              width: '100%',
              height: 1,
              background: i < idx ? 'var(--accent)' : 'var(--surface-border)',
              transition: 'background 300ms',
              zIndex: 0,
            }} />
          )}
          <div style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: `1px solid ${i < idx ? 'var(--accent)' : i === idx ? 'var(--accent)' : 'var(--surface-border)'}`,
            background: i < idx ? 'var(--accent)' : 'var(--surface-raised)',
            zIndex: 1,
            flexShrink: 0,
            transition: 'all 200ms',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: i <= idx ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            textAlign: 'center',
            lineHeight: 1.3,
            maxWidth: 60,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {STAGE_LABEL[stage].split(' ').slice(-1)[0]}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChainCard({ chain, index, onFixClick }) {
  const [expanded, setExpanded] = useState(index === 0)
  const confidencePct = Math.round((chain.confidence || 0) * 100)
  const confClass = chain.confidence >= 0.8 ? 'high-conf' : 'low-conf'

  const impactClass =
    chain.impact === 'Critical' ? 'badge-critical' :
    chain.impact === 'High'     ? 'badge-high'     :
    chain.impact === 'Medium'   ? 'badge-medium'   : 'badge-safe'

  return (
    <div className="chain-card">
      <div className="chain-card-header" onClick={() => setExpanded(e => !e)}>
        <div>
          <div className="chain-card-title">{chain.title}</div>
          <div className="chain-card-meta">
            <span className={`badge ${impactClass}`}>{chain.impact || 'Unknown'}</span>
            <div className="confidence-meter">
              <div className="confidence-track">
                <div className={`confidence-fill ${confClass}`} style={{ width: `${confidencePct}%` }} />
              </div>
              <span className="confidence-value">{confidencePct}%</span>
            </div>
            <span className="text-mono text-xs text-muted">
              {chain.steps?.length || 0} step{chain.steps?.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0, marginTop: 4 }}>
          <path d="M2 4l4 4 4-4" />
        </svg>
      </div>

      {/* Historical Breach Similarity Banner */}
      {chain.historical_similarity && (
        <div style={{
          padding: '8px 14px',
          background: 'linear-gradient(90deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)',
          borderTop: '1px solid rgba(239,68,68,0.2)',
          borderBottom: '1px solid rgba(239,68,68,0.1)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{
            flexShrink: 0, fontSize: 9, fontFamily: 'var(--font-mono)',
            color: '#ef4444', background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4,
            padding: '2px 6px', whiteSpace: 'nowrap', letterSpacing: '0.06em', marginTop: 1,
          }}>
            BREACH MATCH
          </span>
          <span style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
            {chain.historical_similarity}
          </span>
        </div>
      )}

      {expanded && (
        <div className="chain-card-body">
          {chain.explanation && (
            <div style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              background: 'var(--surface-base)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '2px solid var(--surface-border)',
            }}>
              {chain.explanation}
            </div>
          )}

          {(chain.steps || []).map((step, i) => (
            <div className="chain-step" key={i}>
              <div className="chain-step-number">{String(i + 1).padStart(2, '0')}</div>
              <div className="chain-step-content">
                <div className="chain-step-node">{step.node}</div>
                {step.mitre_tactic && (
                  <div className="chain-step-mitre">
                    <span className="badge badge-info" style={{ marginBottom: 4, display: 'inline-block' }}>
                      {step.mitre_tactic}
                    </span>
                  </div>
                )}
                <div className="chain-step-weakness">{step.weakness}</div>
                <div className="chain-step-action">{step.action}</div>
                {step.fix && (
                  <div className="chain-step-fix">
                    Remediation: {step.fix}
                  </div>
                )}
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <button 
                    className="btn btn-ghost btn-sm" 
                    style={{ fontSize: 11, color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                    onClick={() => onFixClick(step)}
                  >
                    Ask AI to Fix
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StreamFeed({ lines }) {
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="stream-feed">
      {lines.map((line, i) => (
        <span
          key={i}
          className={`stream-line ${
            line.type === 'error'       ? 'error'   :
            line.type === 'stage_start' ? 'stage'   :
            line.type === 'done'        ? 'success' : ''
          }`}
        >
          {line.message}
        </span>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

export default function Results() {
  const { runId }   = useParams()
  const navigate    = useNavigate()
  const [stage, setStage]               = useState('pending')
  const [logs, setLogs]                 = useState([])
  const [data, setData]                 = useState(null)
  const [activeChain, setActiveChain]   = useState(null)
  const [error, setError]               = useState('')
  const [cloneStatus, setCloneStatus]   = useState(null)  // null | 'pending' | 'kept' | 'deleted'
  const [clonePath, setClonePath]       = useState(null)
  const [activeFixStep, setActiveFixStep] = useState(null)

  const addLog = useCallback((entry) => {
    setLogs(prev => [...prev.slice(-200), entry])
  }, [])

  const handleClone = useCallback(async (action) => {
    setCloneStatus('pending')
    try {
      const res = await fetch(`${BACKEND}/api/runs/${runId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const result = await res.json()
      if (action === 'delete') {
        setCloneStatus('deleted')
      } else {
        setCloneStatus('kept')
        setClonePath(result.path)
      }
    } catch {
      setCloneStatus(null)
    }
  }, [runId])

  // SSE stream
  useEffect(() => {
    const es = new EventSource(`${BACKEND}/api/stream/${runId}`)

    es.onmessage = (e) => {
      const evt = JSON.parse(e.data)
      if (evt.type === 'heartbeat') return

      addLog(evt)

      if (evt.stage) setStage(evt.stage)

      if (evt.type === 'done') {
        es.close()
        fetch(`${BACKEND}/api/runs/${runId}`)
          .then(r => r.json())
          .then(d => {
            setData(d)
            // Check if clone exists
            fetch(`${BACKEND}/api/runs/${runId}/clone`)
              .then(r => r.json())
              .then(c => { if (c.has_clone) setCloneStatus('available') })
              .catch(() => {})
          })
          .catch(() => setError('Failed to load results.'))
      }

      if (evt.type === 'error') {
        es.close()
        setError(evt.message)
      }
    }

    es.onerror = () => {
      es.close()
      setError('Stream connection lost.')
    }

    return () => es.close()
  }, [runId, addLog])

  const highlightIds = activeChain
    ? (data?.chains[activeChain]?.node_ids || [])
    : []

  const riskScore = data
    ? Math.min(100, Math.round(
        (data.chains.filter(c => c.impact === 'Critical').length * 35 +
         data.chains.filter(c => c.impact === 'High').length * 20 +
         data.findings.filter(f => f.severity === 'ERROR').length * 4) / 1
      ))
    : 0

  return (
    <div className="page" style={{ maxWidth: '100%', padding: 'var(--space-6)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="page-title">Analysis Results</div>
          <div className="page-subtitle">
            Run #{runId}
            {data?.run?.repo_url && (
              <span className="text-mono" style={{ marginLeft: 8, color: 'var(--accent)' }}>
                {data.run.repo_url.replace('https://github.com/', '')}
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analyze')}>
          New Analysis
        </button>
      </div>

      {/* Progress stepper */}
      <ProgressStepper currentStage={stage} />

      {/* Error state */}
      {error && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--critical-dim)',
          border: '1px solid var(--critical-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--critical)',
          fontSize: 13,
          marginBottom: 'var(--space-6)',
        }}>
          {error}
        </div>
      )}

      {/* Live log — shown while running */}
      {stage !== 'done' && !error && (
        <div className="mb-6">
          <div className="card-title mb-2">Pipeline log</div>
          <StreamFeed lines={logs} />
        </div>
      )}

      {/* Clone decision banner — appears once analysis finishes */}
      {cloneStatus === 'available' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-5)',
          background: 'var(--surface-raised)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-5)',
        }}>
          <div>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
              Cloned repository is still on disk.
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>
              Keep it for manual review, or delete it to free space.
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleClone('keep')}
              disabled={cloneStatus === 'pending'}
            >
              Keep clone
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'var(--critical-dim)', color: 'var(--critical)', border: '1px solid var(--critical-border)' }}
              onClick={() => handleClone('delete')}
              disabled={cloneStatus === 'pending'}
            >
              Delete clone
            </button>
          </div>
        </div>
      )}

      {cloneStatus === 'kept' && clonePath && (
        <div style={{
          padding: 'var(--space-3) var(--space-5)',
          background: 'var(--safe-dim)', border: '1px solid var(--safe-border)',
          borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)',
          fontSize: 12, color: 'var(--safe)',
        }}>
          Clone preserved at{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{clonePath}</code>
        </div>
      )}

      {cloneStatus === 'deleted' && (
        <div style={{
          padding: 'var(--space-3) var(--space-5)',
          background: 'var(--surface-raised)', border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)',
          fontSize: 12, color: 'var(--text-tertiary)',
        }}>
          Clone deleted from disk.
        </div>
      )}

      {/* Results — shown when done */}
      {data && (

        <>
          {/* Summary stats */}
          <div className="grid-4 mb-6">
            <div className="card card-sm">
              <div className="stat-block">
                <div className={`stat-value ${riskScore > 70 ? 'critical' : riskScore > 40 ? 'high' : 'safe'}`}>
                  {riskScore}
                </div>
                <div className="stat-label">Risk Score</div>
              </div>
            </div>
            <div className="card card-sm">
              <div className="stat-block">
                <div className="stat-value critical">
                  {data.findings.filter(f => f.severity === 'ERROR').length}
                </div>
                <div className="stat-label">Critical Findings</div>
              </div>
            </div>
            <div className="card card-sm">
              <div className="stat-block">
                <div className="stat-value accent">{data.chains.length}</div>
                <div className="stat-label">Attack Chains</div>
              </div>
            </div>
            <div className="card card-sm">
              <div className="stat-block">
                <div className="stat-value">{data.graph?.nodes?.length || 0}</div>
                <div className="stat-label">Code Nodes</div>
              </div>
            </div>
          </div>

          {/* Graph + chains layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {/* Attack graph */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 380 }}>
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--surface-border)' }}>
                <div className="card-title">Code Attack Graph</div>
                <div className="card-subtitle">
                  Force-directed — drag nodes, scroll to zoom.
                  {activeChain !== null && ' Highlighted nodes belong to selected chain.'}
                </div>
              </div>
              <div style={{ height: 460 }}>
                <AttackGraph
                  nodes={data.graph?.nodes || []}
                  edges={data.graph?.edges || []}
                  highlightIds={highlightIds}
                />
              </div>
            </div>

            {/* Chain list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className="card-title">Attack Chains</div>
              {data.chains.length === 0 ? (
                <div className="card card-sm">
                  <div className="text-muted text-sm">
                    No exploitable chains identified. The model found no realistic multi-step paths between the vulnerabilities discovered.
                  </div>
                </div>
              ) : (
                data.chains.map((chain, i) => (
                <div
                  key={i}
                  onMouseEnter={() => setActiveChain(i)}
                  onMouseLeave={() => setActiveChain(null)}
                >
                  <ChainCard chain={chain} index={i} onFixClick={setActiveFixStep} />
                </div>
              ))
              )}
            </div>
          </div>

          {/* Findings table */}
          <div className="card">
            <div className="card-header mb-4">
              <div>
                <div className="card-title">All Findings</div>
                <div className="card-subtitle">
                  {data.findings.length} total across all scanners
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Source</th>
                    <th>Rule</th>
                    <th>File</th>
                    <th>Line</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.findings
                    .sort((a, b) =>
                      (a.severity === 'ERROR' ? 0 : 1) - (b.severity === 'ERROR' ? 0 : 1)
                    )
                    .map((f) => (
                      <tr key={f.id}>
                        <td>
                          <span className={`badge ${f.severity === 'ERROR' ? 'badge-critical' : f.severity === 'WARNING' ? 'badge-medium' : 'badge-info'}`}>
                            {f.severity}
                          </span>
                        </td>
                        <td><span className="badge badge-info">{f.source}</span></td>
                        <td>
                          <span className="inline-code truncate" style={{ maxWidth: 160, display: 'inline-block' }}>
                            {f.rule_id}
                          </span>
                        </td>
                        <td className="text-mono text-xs">{f.file_path}</td>
                        <td className="text-mono text-xs text-muted">{f.line_start || '-'}</td>
                        <td style={{ fontSize: 12, maxWidth: 280 }}>{f.message}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Render Fix-It Panel as an overlay if a step is selected */}
      {activeFixStep && (
        <FixItPanel 
          runId={runId} 
          stepContext={activeFixStep} 
          onClose={() => setActiveFixStep(null)} 
        />
      )}

    </div>
  )
}
