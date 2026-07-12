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

const ProgressStepper = React.memo(function ProgressStepper({ currentStage }) {
  const idx = STAGES.indexOf(currentStage)
  return (
    <div className="progress-stepper">
      {STAGES.map((stage, i) => {
        const isDone   = i < idx
        const isActive = i === idx
        return (
          <div key={stage} className="stepper-step">
            {i < STAGES.length - 1 && (
              <div className={`stepper-connector ${isDone ? 'done' : ''}`} />
            )}
            <div className={`stepper-dot ${isDone ? 'done' : isActive ? 'active' : ''}`}>
              {isDone && (
                <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.8" style={{ width: 10, height: 10 }}>
                  <path d="M2 5l2.5 2.5L8 3"/>
                </svg>
              )}
            </div>
            <span className={`stepper-label ${isDone ? 'done' : isActive ? 'active' : ''}`}>
              {STAGE_LABEL[stage].split(' ').slice(-1)[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
})

const ChainCard = React.memo(function ChainCard({ chain, sandbox, index, onFixClick }) {
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
            <span className="text-mono text-xs text-muted" style={{ marginRight: 8 }}>
              {chain.steps?.length || 0} step{chain.steps?.length !== 1 ? 's' : ''}
            </span>
            
            {/* Dynamic Tags */}
            <span style={{
              padding: '2px 6px', background: 'var(--primary-dim)', border: '1px solid var(--primary-border)',
              borderRadius: 'var(--radius-sm)', fontSize: 9, fontWeight: 600, color: 'var(--primary-light)'
            }}>
              Attack Opening
            </span>
            
            {chain.impact === 'Critical' && (
              <span style={{
                padding: '2px 6px', background: 'var(--critical-dim)', border: '1px solid var(--critical-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 9, fontWeight: 600, color: 'var(--critical)'
              }}>
                Critical Opening
              </span>
            )}
            
            {chain.steps?.some(s => s.action?.toLowerCase().match(/script|shell|bash|python|exec/)) && (
              <span style={{
                padding: '2px 6px', background: 'var(--warning-dim)', border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 9, fontWeight: 600, color: 'var(--warning)'
              }}>
                Scripted Attack
              </span>
            )}
            
            {chain.steps?.some(s => s.action?.toLowerCase().match(/payload|rce|injection|malicious/)) && (
              <span style={{
                padding: '2px 6px', background: 'var(--critical-dim)', border: '1px solid var(--critical-border)',
                borderRadius: 'var(--radius-sm)', fontSize: 9, fontWeight: 600, color: 'var(--critical)'
              }}>
                Malicious Payload
              </span>
            )}

            <span style={{
              padding: '2px 6px', background: 'var(--surface-active)', border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-sm)', fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)'
            }}>
              SOC2
            </span>
          </div>
        </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0, marginTop: 4 }}>
          <path d="M2 4l4 4 4-4" />
        </svg>
      </div>

      {/* Historical Breach Similarity Banner */}
      {chain.historical_similarity && (
        <div style={{
          padding: '8px 14px',
          background: 'var(--critical-dim)',
          borderTop: '1px solid var(--critical-border)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{
            flexShrink: 0, fontSize: 9, fontFamily: 'var(--font-mono)',
            color: 'var(--critical)', background: 'var(--critical-dim)',
            border: '1px solid var(--critical-border)', borderRadius: 4,
            padding: '2px 6px', whiteSpace: 'nowrap', letterSpacing: '0.06em', marginTop: 1,
          }}>
            BREACH MATCH
          </span>
          <span style={{ fontSize: 11, color: 'var(--critical)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
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

          {sandbox && (
            <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--surface-border)', paddingTop: 'var(--space-3)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 'var(--space-2)' }}>
                🛡️ AI-Generated Micro-Firewall (AppArmor)
              </div>
              <pre style={{ margin: 0, padding: 'var(--space-3)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {sandbox.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

const StreamFeed = React.memo(function StreamFeed({ lines }) {
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div style={{
      background: '#F8FAFF',
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-3) var(--space-4)',
      height: 160,
      overflowY: 'auto',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      {lines.map((line, i) => (
        <span
          key={i}
          style={{
            color:
              line.type === 'error'       ? 'var(--critical)' :
              line.type === 'stage_start' ? 'var(--primary-dark)' :
              line.type === 'done'        ? 'var(--safe)' :
              'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {line.message}
        </span>
      ))}
      <div ref={bottomRef} />
    </div>
  )
})

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
  const [searchInput, setSearchInput]   = useState('')
  const [graphSearch, setGraphSearch]   = useState('')
  const [previewFile, setPreviewFile]   = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setGraphSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleNodeClick = useCallback(async (node) => {
    if (node.id) {
      try {
        const res = await fetch(`${BACKEND}/api/runs/${runId}/file?path=${encodeURIComponent(node.id)}`)
        if (res.ok) {
          const json = await res.json()
          setPreviewFile({ path: node.id, content: json.content })
        }
      } catch (e) {
        console.error(e)
      }
    }
  }, [runId])

  const exportCSV = useCallback(() => {
    if (!data) return
    let csv = "Severity,Source,Rule,File,Line,Description\\n"
    data.findings.forEach(f => {
      csv += `"${f.severity}","${f.source}","${f.rule_id}","${f.file_path}","${f.line_start || ''}","${f.message.replace(/"/g, '""')}"\\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance_report_run_${runId}.csv`
    a.click()
  }, [data, runId])

  const addLog = useCallback((entry) => {
    setLogs(prev => [...prev.slice(-200), entry])
  }, [])

  const handlePublishIntel = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/threat-intel/publish/${runId}`, {
        method: 'POST'
      })
      const result = await res.json()
      if (result.status === 'ok') {
        alert(`Published ${result.published} chains to decentralized threat intel network.`)
      } else {
        alert('No chains to publish or error occurred.')
      }
    } catch (e) {
      alert(`Error publishing: ${e.message}`)
    }
  }

  const handleChaos = async () => {
    if (!window.confirm("Are you sure you want to inject a live vulnerability into the cloned repository branch?")) return;
    
    try {
      const res = await fetch(`${BACKEND}/api/runs/${runId}/chaos`, { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        alert(result.message)
      } else {
        alert(`Failed: ${result.detail}`)
      }
    } catch (e) {
      alert(`Error triggering chaos mode: ${e.message}`)
    }
  }

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
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--warning-dim)', border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)'
        }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--warning)', fontSize: 13, marginBottom: 2 }}>
              Repository Quarantined in Security Box
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Execute permissions are disabled to prevent malware spread. Extract to normal path, or securely wipe completely (bypasses recycle bin).
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleClone('keep')}
              disabled={cloneStatus === 'pending'}
            >
              Extract to Safe Path
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'var(--critical-dim)', color: 'var(--critical)', border: '1px solid var(--critical-border)' }}
              onClick={() => handleClone('delete')}
              disabled={cloneStatus === 'pending'}
            >
              Secure Destroy (Irreversible)
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
          Clone extracted from Security Box to{' '}
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
          Files completely wiped and destroyed. No recovery possible.
        </div>
      )}

      {/* Results — shown when done */}
      {data && (

        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <button className="btn btn-sm" onClick={handleChaos} style={{ background: 'var(--critical-dim)', color: 'var(--critical)', border: '1px solid var(--critical-border)' }}>
              <span style={{ fontSize: 13, marginRight: 6 }}>🧪</span> Inject Chaos
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handlePublishIntel}>
              <span style={{ fontSize: 13, marginRight: 6 }}>🌍</span> Publish to Threat Intel Network
            </button>
            <button className="btn btn-sm" onClick={exportCSV} style={{ background: 'var(--primary-dark)', color: 'white', border: 'none' }}>
              Export Compliance Report (CSV)
            </button>
          </div>

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
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="card-title">Code Attack Graph</div>
                  <div className="card-subtitle">
                    Force-directed — drag nodes, scroll to zoom.
                    {activeChain !== null && ' Highlighted nodes belong to selected chain.'}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search files or modules..."
                  className="form-input"
                  style={{ width: 200, fontSize: 12, padding: '4px 8px' }}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div style={{ height: 460 }}>
                <AttackGraph
                  nodes={data.graph?.nodes || []}
                  edges={data.graph?.edges || []}
                  highlightIds={highlightIds}
                  searchQuery={graphSearch}
                  onNodeClick={handleNodeClick}
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
                data.chains.map((chain, i) => {
                  const sandbox = data.sandboxes?.find(s => s.chain_id === chain.id)
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setActiveChain(i)}
                      onMouseLeave={() => setActiveChain(null)}
                    >
                      <ChainCard chain={chain} sandbox={sandbox} index={i} onFixClick={setActiveFixStep} />
                    </div>
                  )
                })
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

      {/* Render Code Preview Panel if a file is clicked */}
      {previewFile && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
          zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setPreviewFile(null)}>
          <div style={{
            width: '80%', height: '80%', background: 'var(--surface-void)',
            border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-lg)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--primary)' }}>{previewFile.path}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setPreviewFile(null)}>Close</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                {previewFile.content}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
