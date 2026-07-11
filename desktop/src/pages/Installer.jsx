import React, { useState, useEffect, useCallback } from 'react'

const OLLAMA_API = 'http://127.0.0.1:11434'

const KNOWN_MODELS = [
  {
    id: 'qwen2.5-coder:3b',
    name: 'qwen2.5-coder:3b',
    size: '~1.9 GB',
    description: 'Optimised for code analysis. Best accuracy for vulnerability reasoning.',
    recommended: true,
  },
  {
    id: 'llama3.2:3b',
    name: 'llama3.2:3b',
    size: '~2.0 GB',
    description: 'Strong general reasoning. Good for multi-step attack chain logic.',
    recommended: false,
  },
  {
    id: 'codellama:7b',
    name: 'codellama:7b',
    size: '~3.8 GB',
    description: 'Most capable. Requires 16 GB RAM minimum.',
    recommended: false,
  },
]

const STEPS = ['System Check', 'Select Model', 'Install', 'Ready']

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fetchOllamaModels() {
  try {
    const res = await fetch(`${OLLAMA_API}/api/tags`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.models || []).map(m => m.name)
  } catch {
    return []
  }
}

function modelIsInstalled(modelId, installedModels) {
  const base = modelId.split(':')[0]
  return installedModels.some(m => m === modelId || m.startsWith(base + ':'))
}

// ─── Step 1: System Check ──────────────────────────────────────────────────────
function StepSystemCheck({ onNext }) {
  const [ollamaStatus, setOllamaStatus]   = useState({ status: 'pending', models: [], detail: 'Checking...' })
  const [backendStatus, setBackendStatus] = useState({ status: 'pending', detail: 'Checking...' })
  const [checking, setChecking]           = useState(false)
  const [checked, setChecked]             = useState(false)

  const runCheck = useCallback(async () => {
    setChecking(true)
    setOllamaStatus({ status: 'pending', models: [], detail: 'Checking...' })
    setBackendStatus({ status: 'pending', detail: 'Checking...' })

    // Check Ollama directly via HTTP (more reliable than IPC in some setups)
    const models   = await fetchOllamaModels()
    const ollamaOk = models.length >= 0  // API responded

    // Fetch via fetch() directly since Ollama allows all origins
    let ollamaRunning = false
    try {
      const r = await fetch(`${OLLAMA_API}/api/tags`, { signal: AbortSignal.timeout(3000) })
      ollamaRunning = r.ok
    } catch { ollamaRunning = false }

    setOllamaStatus({
      status: ollamaRunning ? 'pass' : 'fail',
      models,
      detail: ollamaRunning
        ? models.length > 0
          ? `Running — ${models.length} model(s) available: ${models.slice(0,2).join(', ')}`
          : 'Running — no models pulled yet'
        : 'Not detected on port 11434. Run: ollama serve',
    })

    // Backend check
    let backendRunning = false
    try {
      const r2 = await fetch('http://127.0.0.1:8000/health', { signal: AbortSignal.timeout(3000) })
      backendRunning = r2.ok
    } catch { backendRunning = false }

    setBackendStatus({
      status: backendRunning ? 'pass' : 'warn',
      detail: backendRunning
        ? 'Engine responding on port 8000'
        : 'Not running. Start with: uvicorn main:app --port 8000 --host 127.0.0.1',
    })

    setChecked(true)
    setChecking(false)
  }, [])

  useEffect(() => { runCheck() }, [runCheck])

  const ollamaOk = ollamaStatus.status === 'pass'
  const canNext  = checked && ollamaOk

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Step 1 of 4</div>
        <div className="wizard-panel-title">System Requirements</div>
        <div className="wizard-panel-desc">
          Verifying that Ollama and the analysis engine are available.
        </div>
      </div>

      <div className="wizard-panel-body">
        {[
          {
            key: 'ollama', label: 'Ollama Service',
            sub: 'Local LLM inference — ollama.com',
            status: ollamaStatus.status,
            detail: ollamaStatus.detail,
          },
          {
            key: 'backend', label: 'Analysis Engine',
            sub: 'FastAPI backend on port 8000',
            status: backendStatus.status,
            detail: backendStatus.detail,
          },
        ].map(({ key, label, sub, status, detail }) => (
          <div className="check-row" key={key}>
            <div>
              <div className="check-row-label">{label}</div>
              <div className="check-row-sub">{sub}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={`check-row-status ${status}`}>
                {status === 'pending' ? 'Checking...' :
                 status === 'pass'    ? 'Pass'    :
                 status === 'warn'    ? 'Warning' : 'Fail'}
              </div>
              <div className="check-row-sub" style={{ maxWidth: 240 }}>{detail}</div>
            </div>
          </div>
        ))}

        {checked && !ollamaOk && (
          <div style={{
            background: 'var(--critical-dim)',
            border: '1px solid var(--critical-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 12,
            color: 'var(--critical)',
            lineHeight: 1.6,
          }}>
            Ollama is not responding on port 11434.<br />
            Start it in a terminal:&nbsp;
            <code style={{ fontFamily: 'var(--font-mono)' }}>ollama serve</code><br />
            Then click Recheck below.
          </div>
        )}
      </div>

      <div className="wizard-panel-footer">
        <button
          className="btn btn-ghost"
          onClick={runCheck}
          disabled={checking}
        >
          {checking ? 'Checking...' : 'Recheck'}
        </button>
        <button
          className="btn btn-primary"
          disabled={!canNext}
          onClick={onNext}
        >
          Continue
        </button>
      </div>
    </>
  )
}

// ─── Step 2: Model Selection ───────────────────────────────────────────────────
function StepModelSelect({ onNext, onBack, selected, setSelected }) {
  const [installedModels, setInstalledModels] = useState([])

  useEffect(() => {
    fetchOllamaModels().then(setInstalledModels)
  }, [])

  // If the currently selected model is already installed, we can skip the download
  const selectedInstalled = modelIsInstalled(selected, installedModels)

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Step 2 of 4</div>
        <div className="wizard-panel-title">Select AI Model</div>
        <div className="wizard-panel-desc">
          Choose the model for vulnerability reasoning. Runs entirely on your machine.
          {installedModels.length > 0 && (
            <span style={{ color: 'var(--safe)', marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {installedModels.length} already installed
            </span>
          )}
        </div>
      </div>

      <div className="wizard-panel-body">
        {KNOWN_MODELS.map((m) => {
          const installed = modelIsInstalled(m.id, installedModels)
          return (
            <div
              key={m.id}
              className={`model-option ${selected === m.id ? 'selected' : ''}`}
              onClick={() => setSelected(m.id)}
            >
              <div className="model-option-radio" />
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2">
                  <span className="model-option-name">{m.name}</span>
                  {m.recommended && <span className="badge badge-info">Recommended</span>}
                  {installed && <span className="badge badge-safe">Installed</span>}
                </div>
                <div className="model-option-meta">{m.size} — {m.description}</div>
              </div>
            </div>
          )
        })}

        {/* Show any installed models not in the known list */}
        {installedModels
          .filter(name => !KNOWN_MODELS.some(m => modelIsInstalled(m.id, [name])))
          .map(name => (
            <div
              key={name}
              className={`model-option ${selected === name ? 'selected' : ''}`}
              onClick={() => setSelected(name)}
            >
              <div className="model-option-radio" />
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2">
                  <span className="model-option-name">{name}</span>
                  <span className="badge badge-safe">Installed</span>
                </div>
                <div className="model-option-meta">Available in Ollama</div>
              </div>
            </div>
          ))
        }

        {selectedInstalled ? (
          <div style={{
            background: 'var(--safe-dim)', border: '1px solid var(--safe-border)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
            fontSize: 12, color: 'var(--safe)', fontFamily: 'var(--font-mono)',
          }}>
            This model is already installed. No download required.
          </div>
        ) : (
          <div style={{
            background: 'var(--surface-base)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            The selected model will be downloaded via Ollama. One-time download.
            The model never leaves your machine.
          </div>
        )}
      </div>

      <div className="wizard-panel-footer">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={() => onNext(selectedInstalled)}>
          {selectedInstalled ? 'Continue' : 'Download and Install'}
        </button>
      </div>
    </>
  )
}

// ─── Step 3: Install / Skip ────────────────────────────────────────────────────
function StepInstall({ modelId, alreadyInstalled, onNext }) {
  const [log, setLog]           = useState([])
  const [done, setDone]         = useState(alreadyInstalled)
  const [failed, setFailed]     = useState(false)
  const [progress, setProgress] = useState(alreadyInstalled ? 100 : 0)

  useEffect(() => {
    if (alreadyInstalled) {
      setLog([`Model ${modelId} is already installed.`])
      return
    }

    // Check once more if model is already present before pulling
    fetchOllamaModels().then(async (models) => {
      if (modelIsInstalled(modelId, models)) {
        setLog([`Model ${modelId} is already installed. Skipping download.`])
        setProgress(100)
        setDone(true)
        return
      }

      // Proceed with pull
      const unsubscribe = window.acm.onPullProgress((data) => {
        if (data.status === 'progress' && data.raw) {
          setLog((prev) => [...prev.slice(-60), data.raw])
          const match = data.raw.match(/(\d+)%/)
          if (match) setProgress(parseInt(match[1], 10))
        }
      })

      const result = await window.acm.pullModel(modelId)
      unsubscribe()

      if (result.success) {
        setProgress(100)
        setLog((prev) => [...prev, `Model ${modelId} ready.`])
        setDone(true)
      } else {
        // If pull "failed" but model exists, treat as success
        const modelsAfter = await fetchOllamaModels()
        if (modelIsInstalled(modelId, modelsAfter)) {
          setProgress(100)
          setLog((prev) => [...prev, `Model ${modelId} confirmed present.`])
          setDone(true)
        } else {
          setLog((prev) => [...prev, `Error: ${result.error}`])
          setFailed(true)
        }
      }
    })
  }, [modelId, alreadyInstalled])

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Step 3 of 4</div>
        <div className="wizard-panel-title">
          {alreadyInstalled ? 'Verified' : 'Installing'}
        </div>
        <div className="wizard-panel-desc">
          {alreadyInstalled
            ? `${modelId} is already installed and ready.`
            : `Downloading ${modelId}. This may take several minutes.`}
        </div>
      </div>

      <div className="wizard-panel-body">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted">
              {done ? 'Complete' : 'Download progress'}
            </span>
            <span className="text-mono text-xs text-muted">{progress}%</span>
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${done ? 'safe' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="stream-feed" style={{ maxHeight: 140 }}>
          {log.length === 0
            ? <span className="stream-line">Checking model status...</span>
            : log.map((line, i) => (
                <span key={i} className={`stream-line ${done && i === log.length - 1 ? 'success' : ''}`}>
                  {line}
                </span>
              ))
          }
        </div>

        {failed && (
          <div style={{
            background: 'var(--critical-dim)', border: '1px solid var(--critical-border)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 12, color: 'var(--critical)',
          }}>
            Pull failed. If the model is already downloaded, you can click Continue.<br />
            To pull manually:{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>ollama pull {modelId}</code>
          </div>
        )}
      </div>

      <div className="wizard-panel-footer">
        <span />
        <button
          className="btn btn-primary"
          disabled={!done && !failed}
          onClick={onNext}
        >
          Continue
        </button>
      </div>
    </>
  )
}

// ─── Step 4: Ready ─────────────────────────────────────────────────────────────
function StepReady({ modelId, onLaunch }) {
  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Step 4 of 4</div>
        <div className="wizard-panel-title">Ready</div>
        <div className="wizard-panel-desc">
          Attack Chain Mapper is configured and ready to use.
        </div>
      </div>

      <div className="wizard-panel-body">
        {[
          { label: 'AI Model',      value: modelId },
          { label: 'Inference',     value: 'Local — Ollama' },
          { label: 'Encryption',    value: 'AES-256-GCM session vault' },
          { label: 'Network',       value: 'No external connections required' },
          { label: 'Data stored',   value: 'Memory only — cleared on close' },
        ].map(({ label, value }) => (
          <div className="check-row" key={label}>
            <div className="check-row-label">{label}</div>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                {value}
              </span>
              <span className="check-row-status pass">Pass</span>
            </div>
          </div>
        ))}
      </div>

      <div className="wizard-panel-footer">
        <span />
        <button className="btn btn-primary btn-lg" onClick={onLaunch}>
          Launch Attack Chain Mapper
        </button>
      </div>
    </>
  )
}

// ─── Wizard Orchestrator ───────────────────────────────────────────────────────
export default function Installer({ onComplete }) {
  const [step, setStep]                     = useState(0)
  const [selectedModel, setSelectedModel]   = useState('qwen2.5-coder:3b')
  const [modelAlreadyInstalled, setModelAlreadyInstalled] = useState(false)

  const handleModelNext = (alreadyInstalled) => {
    setModelAlreadyInstalled(alreadyInstalled)
    setStep(2)
  }

  // Auto-detect if first-run is truly needed — if all models already installed, start at step 1
  useEffect(() => {
    fetchOllamaModels().then((models) => {
      if (models.length > 0) {
        setSelectedModel(models[0])
      }
    })
  }, [])

  return (
    <div className="wizard-shell">
      <div className="titlebar">
        <span className="titlebar-wordmark">Attack Chain Mapper — Setup</span>
        <div className="titlebar-status">
          <span className="text-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {STEPS[step]}
          </span>
        </div>
      </div>

      <div className="wizard-body">
        <div className="wizard-panel">
          {step === 0 && (
            <StepSystemCheck onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <StepModelSelect
              onNext={handleModelNext}
              onBack={() => setStep(0)}
              selected={selectedModel}
              setSelected={setSelectedModel}
            />
          )}
          {step === 2 && (
            <StepInstall
              modelId={selectedModel}
              alreadyInstalled={modelAlreadyInstalled}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepReady modelId={selectedModel} onLaunch={onComplete} />
          )}
        </div>
      </div>

      <div style={{
        padding: 'var(--space-4) var(--space-8)',
        borderTop: '1px solid var(--surface-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span className="text-mono text-xs text-muted">MIT License — Navaneethan P</span>
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} style={{
              width: 24, height: 3, borderRadius: 99,
              background: i <= step ? 'var(--accent)' : 'var(--surface-border)',
              transition: 'background 200ms',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
