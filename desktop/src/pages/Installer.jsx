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

const CLOUD_PROVIDERS = [
  { id: 'claude', name: 'Anthropic Claude', defaultModel: 'claude-3-5-haiku-20241022' },
  { id: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-2.0-flash' },
  { id: 'openai', name: 'OpenAI GPT', defaultModel: 'gpt-4o-mini' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fetchOllamaModels() {
  try {
    const res = await fetch(`${OLLAMA_API}/api/tags`, { signal: AbortSignal.timeout(2000) })
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
        <div className="model-option" onClick={() => onSelectMode('local')}>
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2">
              <span className="model-option-name" style={{ color: 'var(--accent)' }}>Private Local AI (Encrypted)</span>
              <span className="badge badge-safe">Recommended</span>
            </div>
            <div className="model-option-meta" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Runs entirely on your machine via Ollama. No data ever leaves your computer. 
              Zero-trust architecture. Requires ~4GB RAM.
            </div>
          </div>
        </div>

        <div className="model-option" onClick={() => onSelectMode('cloud')}>
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2">
              <span className="model-option-name" style={{ color: 'var(--info)' }}>Cloud API (High Performance)</span>
            </div>
            <div className="model-option-meta" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Connect directly to Claude, Gemini, or OpenAI using your own API key. 
              Much faster and does not require a powerful local machine.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Step 1: Local Check & Auto-Install Script ─────────────────────────────────
function StepLocalCheck({ onNext, onBack }) {
  const [ollamaStatus, setOllamaStatus] = useState('pending') // 'pending', 'pass', 'fail'
  
  const checkOllama = useCallback(async () => {
    setOllamaStatus('pending')
    try {
      const r = await fetch(`${OLLAMA_API}/api/tags`, { signal: AbortSignal.timeout(2000) })
      if (r.ok) setOllamaStatus('pass')
      else setOllamaStatus('fail')
    } catch { 
      setOllamaStatus('fail')
    }
  }, [])

  useEffect(() => { checkOllama() }, [checkOllama])

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

  const copyScript = () => {
    navigator.clipboard.writeText(psScript)
  }

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Local Engine Setup</div>
        <div className="wizard-panel-title">System Requirements</div>
        <div className="wizard-panel-desc">Checking for Ollama installation on port 11434.</div>
      </div>

      <div className="wizard-panel-body">
        <div className="check-row">
          <div>
            <div className="check-row-label">Ollama Service</div>
            <div className="check-row-sub">Local LLM inference — ollama.com</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={`check-row-status ${ollamaStatus}`}>
              {ollamaStatus === 'pending' ? 'Checking...' : ollamaStatus === 'pass' ? 'Found' : 'Not Found'}
            </div>
          </div>
        </div>

        {ollamaStatus === 'fail' && (
          <div style={{
            background: 'var(--surface-base)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginTop: 16
          }}>
            <div style={{ fontSize: 13, color: 'var(--critical)', marginBottom: 8, fontWeight: 500 }}>
              Ollama is not installed or not running.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Run this command in <strong>PowerShell</strong> to automatically install Ollama and the AI model:
            </div>
            <div style={{ position: 'relative' }}>
              <pre style={{
                background: '#09090b', padding: 12, borderRadius: 6, fontSize: 11,
                border: '1px solid #27272a', color: '#a1a1aa', overflowX: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
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

      <div className="wizard-panel-footer">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <div className="flex gap-2">
          {ollamaStatus === 'fail' && (
            <button className="btn btn-ghost" onClick={checkOllama}>Recheck</button>
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

  useEffect(() => { fetchOllamaModels().then(setInstalledModels) }, [])

  const selectedInstalled = modelIsInstalled(selected, installedModels)

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Local Engine Setup</div>
        <div className="wizard-panel-title">Select AI Model</div>
        <div className="wizard-panel-desc">Choose the model for vulnerability reasoning.</div>
      </div>

      <div className="wizard-panel-body">
        {KNOWN_MODELS.map((m) => {
          const installed = modelIsInstalled(m.id, installedModels)
          return (
            <div key={m.id} className={`model-option ${selected === m.id ? 'selected' : ''}`} onClick={() => setSelected(m.id)}>
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

        {selectedInstalled ? (
          <div style={{
            background: 'var(--safe-dim)', border: '1px solid var(--safe-border)',
            borderRadius: 'var(--radius-md)', padding: '12px 16px',
            fontSize: 12, color: 'var(--safe)', fontFamily: 'var(--font-mono)', marginTop: 16
          }}>
            This model is already installed. No download required.
          </div>
        ) : (
          <div style={{
            background: 'var(--surface-base)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)', padding: '12px 16px',
            fontSize: 12, color: 'var(--text-secondary)', marginTop: 16
          }}>
            The selected model will be downloaded via Ollama.
          </div>
        )}
      </div>

      <div className="wizard-panel-footer">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={() => onNext(selectedInstalled)}>
          {selectedInstalled ? 'Continue' : 'Download Model'}
        </button>
      </div>
    </>
  )
}

// ─── Step 3: Cloud API Config ──────────────────────────────────────────────────
function StepCloudConfig({ onNext, onBack, config, setConfig }) {
  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Cloud Engine Setup</div>
        <div className="wizard-panel-title">Configure API Provider</div>
        <div className="wizard-panel-desc">
          Connect directly to a commercial AI model. Keys are stored locally in an encrypted vault.
        </div>
      </div>

      <div className="wizard-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            Provider
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {CLOUD_PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setConfig({ ...config, provider: p.id, model: p.defaultModel })}
                className={`btn ${config.provider === p.id ? 'btn-primary' : 'btn-ghost'}`}
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
            API Key
          </label>
          <input 
            type="password" 
            className="input-field" 
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="sk-..."
            style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      <div className="wizard-panel-footer">
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

  const handleLaunch = async () => {
    setSaving(true)
    const payload = mode === 'local' 
      ? { provider: 'ollama', model: localModel, api_key: '' }
      : { provider: cloudConfig.provider, model: cloudConfig.model, api_key: cloudConfig.apiKey }

    try {
      await fetch('http://127.0.0.1:8000/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (e) {
      console.warn("Failed to save config, proceeding anyway.", e)
    }
    
    onLaunch()
  }

  return (
    <>
      <div className="wizard-panel-header">
        <div className="wizard-step-indicator">Final Step</div>
        <div className="wizard-panel-title">Ready</div>
        <div className="wizard-panel-desc">Attack Chain Mapper is configured and ready.</div>
      </div>

      <div className="wizard-panel-body">
        {mode === 'local' ? (
          <>
            <div className="check-row"><div className="check-row-label">Engine</div><div className="text-mono text-xs text-muted">Local (Ollama)</div></div>
            <div className="check-row"><div className="check-row-label">Model</div><div className="text-mono text-xs text-muted">{localModel}</div></div>
            <div className="check-row"><div className="check-row-label">Privacy</div><div className="text-mono text-xs" style={{color:'var(--safe)'}}>Zero Egress</div></div>
          </>
        ) : (
          <>
            <div className="check-row"><div className="check-row-label">Engine</div><div className="text-mono text-xs text-muted">Cloud API</div></div>
            <div className="check-row"><div className="check-row-label">Provider</div><div className="text-mono text-xs text-muted">{cloudConfig.provider}</div></div>
            <div className="check-row"><div className="check-row-label">Model</div><div className="text-mono text-xs text-muted">{cloudConfig.model}</div></div>
          </>
        )}
      </div>

      <div className="wizard-panel-footer">
        <span />
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

  return (
    <div className="wizard-shell">
      <div className="titlebar">
        <span className="titlebar-wordmark">Attack Chain Mapper — Setup</span>
      </div>

      <div className="wizard-body">
        <div className="wizard-panel">
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
