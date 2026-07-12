import React, { useState, useEffect, useCallback } from 'react'

const OLLAMA_API = 'http://127.0.0.1:11434'

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconLock = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 16, height: 16, flexShrink: 0 }}>
    <rect x="3" y="7" width="10" height="7" rx="1.5"/>
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>
  </svg>
)
const IconCloud = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 16, height: 16, flexShrink: 0 }}>
    <path d="M13.5 10c1.38 0 2.5-1.12 2.5-2.5S14.88 5 13.5 5c-.17 0-.34.02-.5.06C12.42 3.26 10.84 2 9 2c-2.43 0-4.44 1.76-4.9 4.09C1.83 6.27 0 8.16 0 10.5 0 12.98 2.02 15 4.5 15h9c1.38 0 2.5-1.12 2.5-2.5 0-1.14-.76-2.11-1.81-2.41z"/>
  </svg>
)
const IconWarning = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <path d="M7 1L13 12H1L7 1z"/>
    <path d="M7 5v3.5M7 10.5v.5"/>
  </svg>
)
const IconCheck = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12, flexShrink: 0 }}>
    <path d="M2 7l3.5 3.5L12 3"/>
  </svg>
)
const IconX = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12, flexShrink: 0 }}>
    <path d="M2 2l10 10M12 2L2 12"/>
  </svg>
)
const IconSpinner = () => (
  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
)
const IconArrowRight = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 16, height: 16 }}>
    <path d="M3 8h10M9 4l4 4-4 4"/>
  </svg>
)

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

const CLOUD_PROVIDERS = [
  { id: 'claude', name: 'Anthropic Claude', defaultModel: 'claude-3-5-haiku-20241022', keyPrefix: 'sk-ant-' },
  { id: 'gemini', name: 'Google Gemini',   defaultModel: 'gemini-2.0-flash',           keyPrefix: 'AIza' },
  { id: 'openai', name: 'OpenAI GPT',      defaultModel: 'gpt-4o-mini',                keyPrefix: 'sk-' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fetchOllamaModels() {
  try {
    const res = await fetch(`${OLLAMA_API}/api/tags`, { signal: AbortSignal.timeout(3000) })
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

// ─── Step 0: Welcome / Choose Mode ─────────────────────────────────────────────
function StepWelcome({ onSelectMode }) {
  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Step 1 of Setup</div>
        <div className="wizard-panel-title">Choose AI Engine</div>
        <div className="wizard-panel-desc">
          Attack Chain Mapper requires an AI model to reason about vulnerabilities.
          Choose how you want to run the engine.
        </div>
      </div>

      <div className="wizard-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="model-option" onClick={() => onSelectMode('local')} style={{ cursor: 'pointer' }}>
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2">
              <IconLock style={{ color: 'var(--primary)' }} />
              <span className="model-option-name" style={{ color: 'var(--primary-dark)' }}>Private Local AI (Encrypted)</span>
              <span className="badge badge-safe">Recommended</span>
            </div>
            <div className="model-option-meta" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Runs entirely on your machine via <strong>Ollama</strong>. No data ever leaves your computer.
              Zero-trust architecture. Requires ~4 GB RAM.
            </div>
          </div>
          <div style={{ color: 'var(--primary)', marginLeft: 12 }}><IconArrowRight /></div>
        </div>

        <div className="model-option" onClick={() => onSelectMode('cloud')} style={{ cursor: 'pointer' }}>
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2">
              <IconCloud style={{ color: 'var(--info)' }} />
              <span className="model-option-name" style={{ color: 'var(--info)' }}>Cloud API (High Performance)</span>
            </div>
            <div className="model-option-meta" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Connect directly to <strong>Claude, Gemini, or OpenAI</strong> using your own API key.
              Much faster and does not require a powerful local machine.
              <br />
              <span style={{ color: 'var(--medium)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <IconWarning style={{ width: 12, height: 12 }} /> Code snippets will be sent to the cloud provider.
              </span>
            </div>
          </div>
          <div style={{ color: 'var(--text-tertiary)', marginLeft: 12 }}><IconArrowRight /></div>
        </div>
      </div>
    </>
  )
}

// ─── Step 1: Local Check & Auto-Install Script ─────────────────────────────────
function StepLocalCheck({ onNext, onBack }) {
  const [ollamaStatus, setOllamaStatus] = useState('pending') // 'pending', 'pass', 'fail'
  const [modelCount, setModelCount]     = useState(0)
  const [starting, setStarting]         = useState(false)

  const checkOllama = useCallback(async () => {
    setOllamaStatus('pending')
    try {
      const r = await fetch(`${OLLAMA_API}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (r.ok) {
        const data = await r.json()
        setModelCount((data.models || []).length)
        setOllamaStatus('pass')
      } else {
        setOllamaStatus('fail')
      }
    } catch {
      setOllamaStatus('fail')
    }
  }, [])

  useEffect(() => { checkOllama() }, [checkOllama])

  const handleStartOllama = async () => {
    setStarting(true)
    await window.acm.startOllama()
    setTimeout(checkOllama, 3000)
    setTimeout(() => setStarting(false), 3000)
  }

  const psScript = `
# Attack Chain Mapper - Auto Setup
Write-Host "Installing Ollama..." -ForegroundColor Cyan
winget install -e --id Ollama.Ollama
Write-Host "Starting Ollama..." -ForegroundColor Cyan
Start-Process "ollama" -ArgumentList "serve" -NoNewWindow
Start-Sleep -Seconds 3
Write-Host "Pulling Qwen2.5-Coder model..." -ForegroundColor Cyan
ollama pull qwen2.5-coder:3b
Write-Host "Done! You can now click Continue." -ForegroundColor Green
  `.trim()

  const copyScript = () => navigator.clipboard.writeText(psScript)

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Local Engine — Step 1 of 2</div>
        <div className="wizard-panel-title">System Requirements Check</div>
        <div className="wizard-panel-desc">Checking for Ollama installation on port 11434.</div>
      </div>

      <div className="wizard-panel-body">
        <div className="settings-row" style={{ background: 'var(--surface-raised)', padding: 12, borderRadius: 8, border: '1px solid var(--surface-border)' }}>
          <div>
            <div className="settings-row-label">Ollama Service</div>
            <div className="settings-row-sub">Local LLM inference — ollama.com</div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6, color: ollamaStatus === 'pass' ? 'var(--safe)' : ollamaStatus === 'fail' ? 'var(--critical)' : 'var(--text-secondary)' }}>
            {ollamaStatus === 'pending' ? <><IconSpinner /> Checking...</> : 
             ollamaStatus === 'pass' ? <><IconCheck /> Found ({modelCount} model{modelCount !== 1 ? 's' : ''})</> : 
             <><IconX /> Not Found</>}
          </div>
        </div>

        {ollamaStatus === 'pass' && modelCount === 0 && (
          <div style={{
            background: 'var(--medium-dim)', border: '1px solid var(--medium-border)',
            borderRadius: 'var(--radius-md)', padding: '12px 16px', marginTop: 16,
            fontSize: 12, color: 'var(--medium)'
          }}>
            Ollama is running but no models are installed yet. Continue to download one.
          </div>
        )}

        {ollamaStatus === 'fail' && (
          <div style={{
            background: 'var(--surface-base)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginTop: 16
          }}>
            <div style={{ fontSize: 13, color: 'var(--critical)', marginBottom: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconWarning /> Ollama is not installed or not running.
            </div>
            
            <button className="btn btn-secondary btn-sm mb-4" onClick={handleStartOllama} disabled={starting}>
              {starting ? 'Starting...' : 'Attempt to Start Ollama'}
            </button>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              If it's not installed, run this command in <strong>PowerShell (Admin)</strong> to automatically install Ollama and the AI model:
            </div>
            <div style={{ position: 'relative' }}>
              <pre className="code-block" style={{ margin: 0, paddingRight: 60 }}>
                {psScript}
              </pre>
              <button
                onClick={copyScript}
                className="btn btn-ghost"
                style={{ position: 'absolute', top: 4, right: 4, padding: '4px 8px', fontSize: 10 }}>
                Copy
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12 }}>
              After the script finishes, click <strong>Recheck</strong>.
            </div>
          </div>
        )}
      </div>

      <div className="wizard-panel-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--surface-border)' }}>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <div className="flex gap-2">
          {ollamaStatus === 'fail' && (
            <button className="btn btn-secondary" onClick={checkOllama}>Recheck</button>
          )}
          <button className="btn btn-primary" disabled={ollamaStatus !== 'pass'} onClick={onNext}>
            Continue
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Step 2: Local Model Selection ─────────────────────────────────────────────
function StepLocalModel({ onNext, onBack, selected, setSelected }) {
  const [installedModels, setInstalledModels] = useState([])
  const [pulling, setPulling]                 = useState(false)
  const [pullLog, setPullLog]                 = useState([])
  const [pullDone, setPullDone]               = useState(false)

  const refresh = useCallback(() => {
    fetchOllamaModels().then(models => {
      setInstalledModels(models)
      // Auto-select first installed model if nothing selected yet or current selection not installed
      if (models.length > 0) {
        const currentInstalled = models.some(m => m === selected || m.startsWith(selected.split(':')[0] + ':'))
        if (!currentInstalled) {
          setSelected(models[0])
        }
      }
    })
  }, [selected, setSelected])

  useEffect(() => { refresh() }, [])

  const selectedInstalled = modelIsInstalled(selected, installedModels)

  // Extra installed models not in KNOWN_MODELS list
  const knownIds  = KNOWN_MODELS.map(m => m.id.split(':')[0])
  const extraModels = installedModels
    .filter(name => !knownIds.some(base => name.startsWith(base + ':') || name === base))
    .map(name => ({ id: name, name, size: 'Installed', description: 'Custom model installed in Ollama.', recommended: false }))

  const allModels = [...KNOWN_MODELS, ...extraModels]

  const handleDownload = async () => {
    if (selectedInstalled) { onNext(); return }
    setPulling(true)
    setPullLog([`Starting download of ${selected}...`])
    try {
      const cleanup = window.acm.onPullProgress((data) => {
        if (data.raw) setPullLog(prev => [...prev.slice(-20), data.raw])
      })
      const result = await window.acm.pullModel(selected)
      cleanup()
      if (result.success) {
        setPullLog(prev => [...prev, 'Download complete!'])
        setPullDone(true)
        await refresh()
      } else {
        setPullLog(prev => [...prev, `Error: ${result.error}`])
      }
    } catch (e) {
      setPullLog(prev => [...prev, `Error: ${e.message}`])
    } finally {
      setPulling(false)
    }
  }

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Local Engine — Step 2 of 2</div>
        <div className="wizard-panel-title">Select AI Model</div>
        <div className="wizard-panel-desc">
          {installedModels.length > 0
            ? `${installedModels.length} model(s) already installed. Select one or download a new one.`
            : 'Choose a model to download via Ollama.'}
        </div>
      </div>

      <div className="wizard-panel-body">
        {allModels.map((m) => {
          const installed = modelIsInstalled(m.id, installedModels)
          return (
            <div key={m.id} className={`model-option ${selected === m.id ? 'selected' : ''}`} onClick={() => setSelected(m.id)} style={{ cursor: 'pointer', marginBottom: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${selected === m.id ? 'var(--primary)' : 'var(--surface-border)'}`, marginRight: 12, background: selected === m.id ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selected === m.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
              </div>
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

        {pulling && (
          <div style={{
            background: 'var(--surface-base)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: 12, marginTop: 12,
            maxHeight: 120, overflowY: 'auto'
          }}>
            {pullLog.map((line, i) => (
              <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{line}</div>
            ))}
          </div>
        )}

        {pullDone && (
          <div style={{
            background: 'var(--safe-dim)', border: '1px solid var(--safe-border)',
            borderRadius: 'var(--radius-md)', padding: '10px 14px', marginTop: 12,
            fontSize: 12, color: 'var(--safe)', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <IconCheck /> Model downloaded successfully. Click Continue.
          </div>
        )}

        {selectedInstalled && !pulling && (
          <div style={{
            background: 'var(--safe-dim)', border: '1px solid var(--safe-border)',
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            fontSize: 12, color: 'var(--safe)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <IconCheck /> This model is already installed. No download required.
          </div>
        )}
      </div>

      <div className="wizard-panel-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--surface-border)' }}>
        <button className="btn btn-ghost" onClick={onBack} disabled={pulling}>Back</button>
        <button
          className="btn btn-primary"
          disabled={pulling || (!selectedInstalled && !pullDone && selected === '')}
          onClick={handleDownload}
        >
          {pulling ? 'Downloading...' : selectedInstalled || pullDone ? 'Continue' : 'Download & Continue'}
        </button>
      </div>
    </>
  )
}

// ─── Step 3: Cloud API Config ──────────────────────────────────────────────────
function StepCloudConfig({ onNext, onBack, config, setConfig }) {
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState(null) // null | 'ok' | 'fail'
  const [testMsg, setTestMsg]   = useState('')

  const handleTest = async () => {
    if (!config.apiKey) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('http://127.0.0.1:8000/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: config.provider, model: config.model, api_key: config.apiKey }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (data.ok) {
        setTestResult('ok')
        setTestMsg('API key verified successfully.')
      } else {
        setTestResult('fail')
        setTestMsg(data.detail || 'API key validation failed.')
      }
    } catch (e) {
      setTestResult('fail')
      setTestMsg('Could not connect to backend. Is it running?')
    } finally {
      setTesting(false)
    }
  }

  const selectedProvider = CLOUD_PROVIDERS.find(p => p.id === config.provider)

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Cloud Engine Setup</div>
        <div className="wizard-panel-title">Configure API Provider</div>
        <div className="wizard-panel-desc">
          Connect to a commercial AI model. Keys are stored locally in the <strong>.env</strong> file — never sent anywhere else.
        </div>
      </div>

      <div className="wizard-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="alert alert-warning">
          <IconWarning />
          <span>Cloud mode sends code snippets to the provider. Your data will leave this machine.</span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Provider
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {CLOUD_PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => { setConfig({ ...config, provider: p.id, model: p.defaultModel }); setTestResult(null) }}
                className={`btn ${config.provider === p.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Model
          </label>
          <input
            type="text"
            className="input-field"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            API Key {selectedProvider && <span style={{ opacity: 0.6 }}>({selectedProvider.keyPrefix}...)</span>}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              className="input-field"
              value={config.apiKey}
              onChange={(e) => { setConfig({ ...config, apiKey: e.target.value }); setTestResult(null) }}
              placeholder={selectedProvider ? `${selectedProvider.keyPrefix}...` : 'Paste your API key'}
              style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
            />
            <button
              className="btn btn-secondary"
              disabled={!config.apiKey || testing}
              onClick={handleTest}
              style={{ flexShrink: 0 }}
            >
              {testing ? '...' : 'Verify'}
            </button>
          </div>
          {testResult === 'ok' && (
            <div style={{ fontSize: 12, color: 'var(--safe)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCheck /> {testMsg}
            </div>
          )}
          {testResult === 'fail' && (
            <div style={{ fontSize: 12, color: 'var(--critical)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconX /> {testMsg}
            </div>
          )}
        </div>
      </div>

      <div className="wizard-panel-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--surface-border)' }}>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary" disabled={!config.apiKey} onClick={onNext}>
          Save & Continue
        </button>
      </div>
    </>
  )
}

// ─── Step 4: Ready ─────────────────────────────────────────────────────────────
function StepReady({ mode, localModel, cloudConfig, onLaunch }) {
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const handleLaunch = async () => {
    setSaving(true)
    setError(null)
    const payload = mode === 'local'
      ? { provider: 'ollama', model: localModel, api_key: '' }
      : { provider: cloudConfig.provider, model: cloudConfig.model, api_key: cloudConfig.apiKey }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error('Backend rejected config')
      onLaunch()
    } catch (e) {
      setError(`Failed to save config: ${e.message}. Check that the backend is running.`)
      setSaving(false)
    }
  }

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Final Step</div>
        <div className="wizard-panel-title">Ready to Launch</div>
        <div className="wizard-panel-desc">Attack Chain Mapper is configured and ready.</div>
      </div>

      <div className="wizard-panel-body">
        <div className="card" style={{ padding: 0 }}>
          {mode === 'local' ? (
            <>
              <div className="settings-row" style={{ padding: 16 }}>
                <div className="settings-row-label">Engine</div>
                <div className="text-mono text-xs text-muted">Local (Ollama)</div>
              </div>
              <div className="settings-row" style={{ padding: 16, borderTop: '1px solid var(--surface-border)' }}>
                <div className="settings-row-label">Model</div>
                <div className="text-mono text-xs text-muted">{localModel}</div>
              </div>
              <div className="settings-row" style={{ padding: 16, borderTop: '1px solid var(--surface-border)' }}>
                <div className="settings-row-label">Privacy</div>
                <div className="text-mono text-xs" style={{ color: 'var(--safe)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconLock /> Zero Egress — No data leaves this machine
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="settings-row" style={{ padding: 16 }}>
                <div className="settings-row-label">Engine</div>
                <div className="text-mono text-xs text-muted">Cloud API</div>
              </div>
              <div className="settings-row" style={{ padding: 16, borderTop: '1px solid var(--surface-border)' }}>
                <div className="settings-row-label">Provider</div>
                <div className="text-mono text-xs text-muted">{cloudConfig.provider}</div>
              </div>
              <div className="settings-row" style={{ padding: 16, borderTop: '1px solid var(--surface-border)' }}>
                <div className="settings-row-label">Model</div>
                <div className="text-mono text-xs text-muted">{cloudConfig.model}</div>
              </div>
              <div className="settings-row" style={{ padding: 16, borderTop: '1px solid var(--surface-border)' }}>
                <div className="settings-row-label">Privacy</div>
                <div className="text-mono text-xs" style={{ color: 'var(--medium)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconWarning /> Code sent to cloud provider
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="alert alert-critical" style={{ marginTop: 16 }}>
            <IconWarning />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="wizard-panel-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--surface-border)' }}>
        <button className="btn btn-primary btn-lg" disabled={saving} onClick={handleLaunch}>
          {saving ? 'Saving...' : 'Launch Application'}
        </button>
      </div>
    </>
  )
}

// ─── Main Wizard ───────────────────────────────────────────────────────────────
export default function Installer({ onComplete }) {
  const [step, setStep] = useState('welcome') // welcome, local_check, local_model, cloud_config, ready
  const [mode, setMode] = useState(null) // 'local' | 'cloud'

  const [localModel, setLocalModel] = useState('qwen2.5-coder:3b')
  const [cloudConfig, setCloudConfig] = useState({ provider: 'claude', model: 'claude-3-5-haiku-20241022', apiKey: '' })

  const steps = [
    { id: 'welcome', label: 'Welcome' },
    { id: mode === 'local' ? 'local_check' : 'cloud_config', label: mode === 'local' ? 'Environment Check' : 'Cloud Setup' },
    ...(mode === 'local' ? [{ id: 'local_model', label: 'Model Selection' }] : []),
    { id: 'ready', label: 'Ready' }
  ]

  const activeIndex = steps.findIndex(s => s.id === step)

  return (
    <div className="wizard-shell">
      <div className="wizard-sidebar">
        <div className="wizard-brand">Attack Chain Mapper</div>
        <div className="wizard-steps-list">
          {steps.map((s, i) => (
            <div key={s.id} className={`wizard-step-item ${i === activeIndex ? 'active' : ''} ${i < activeIndex ? 'done' : ''}`}>
              <div className="wizard-step-dot">{i < activeIndex ? <IconCheck /> : i + 1}</div>
              {s.label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', fontSize: 11, opacity: 0.6, lineHeight: 1.6 }}>
          Zero-trust by default.<br />
          Encrypted execution.<br />
          Open source.
        </div>
      </div>

      <div className="wizard-main">
        <div className="wizard-panel" style={{ maxWidth: 640, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {step === 'welcome' && (
            <StepWelcome
              onSelectMode={(m) => {
                setMode(m)
                setStep(m === 'local' ? 'local_check' : 'cloud_config')
              }}
            />
          )}
          {step === 'local_check' && (
            <StepLocalCheck
              onBack={() => setStep('welcome')}
              onNext={() => setStep('local_model')}
            />
          )}
          {step === 'local_model' && (
            <StepLocalModel
              selected={localModel} setSelected={setLocalModel}
              onBack={() => setStep('local_check')}
              onNext={() => setStep('ready')}
            />
          )}
          {step === 'cloud_config' && (
            <StepCloudConfig
              config={cloudConfig} setConfig={setCloudConfig}
              onBack={() => setStep('welcome')}
              onNext={() => setStep('ready')}
            />
          )}
          {step === 'ready' && (
            <StepReady
              mode={mode} localModel={localModel} cloudConfig={cloudConfig}
              onLaunch={onComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}
