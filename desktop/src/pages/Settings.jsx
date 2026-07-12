import React, { useState, useEffect, useCallback } from 'react'

const BACKEND = 'http://127.0.0.1:8000'

// ─── Icons ─────────────────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
    <path d="M2 7l3.5 3.5L12 3"/>
  </svg>
)
const IconX = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
    <path d="M2 2l10 10M12 2L2 12"/>
  </svg>
)
const IconPlay = () => (
  <svg viewBox="0 0 12 12" fill="currentColor" style={{ width: 11, height: 11 }}>
    <polygon points="2,1 10,6 2,11"/>
  </svg>
)
const IconRefresh = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 12, height: 12 }}>
    <path d="M12 2v4H8"/>
    <path d="M2 12v-4h4"/>
    <path d="M3.5 5a5 5 0 018.5-1"/>
    <path d="M10.5 9a5 5 0 01-8.5 1"/>
  </svg>
)
const IconWarning = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13, flexShrink: 0 }}>
    <path d="M7 1L13 12H1L7 1z"/>
    <path d="M7 5v3.5M7 10.5v.5"/>
  </svg>
)
const IconShield = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 12, height: 12, flexShrink: 0 }}>
    <path d="M7 1L1 3v4c0 3 2.5 5 6 6 3.5-1 6-3 6-6V3L7 1z"/>
  </svg>
)

const CLOUD_PROVIDERS = [
  { id: 'claude', name: 'Anthropic Claude', models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5'], docsUrl: 'https://console.anthropic.com/keys' },
  { id: 'gemini', name: 'Google Gemini',   models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.5-pro'],            docsUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'openai', name: 'OpenAI GPT',      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],                docsUrl: 'https://platform.openai.com/api-keys' },
]

// ─── Ollama Section ─────────────────────────────────────────────────────────────
function OllamaSection({ currentProvider }) {
  const [status, setStatus]     = useState('checking')
  const [models, setModels]     = useState([])
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  const check = useCallback(async () => {
    setStatus('checking')
    try {
      const info = await window.acm.checkOllama()
      if (info.running) {
        setStatus('running')
        setModels(info.models || [])
      } else {
        setStatus('offline')
        setModels([])
      }
    } catch {
      setStatus('offline')
    }
  }, [])

  useEffect(() => { check() }, [check])

  const handleSetLocal = async () => {
    if (models.length === 0) return
    try {
      await fetch(`${BACKEND}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'ollama', model: models[0].name || models[0], api_key: '' }),
      })
      window.location.reload()
    } catch (e) {
      alert('Failed to update config: ' + e.message)
    }
  }

  const handleStart = async () => {
    setStarting(true)
    setStartError('')
    const result = await window.acm.startOllama()
    if (!result.started) {
      setStartError(result.error || 'Failed to start Ollama. Is it installed?')
      setStarting(false)
      return
    }
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const info = await window.acm.checkOllama()
      if (info.running || attempts >= 8) {
        clearInterval(poll)
        setStarting(false)
        if (info.running) {
          setStatus('running')
          setModels(info.models || [])
        } else {
          setStartError('Ollama started but is not responding yet. Try recheck.')
        }
      }
    }, 1000)
  }

  const statusColor = { running: 'var(--safe)', offline: 'var(--critical)', checking: 'var(--medium)' }[status]
  const statusDot = { running: 'online', offline: 'offline', checking: 'pending' }[status]

  return (
    <div className="settings-section">
      <div className="settings-section-title">Local Engine (Ollama)</div>
      <div className="settings-section-desc">
        Runs 100% on your machine via Ollama. No data ever leaves this computer.
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Ollama Service</div>
            <div className="settings-row-sub">http://127.0.0.1:11434</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`status-dot ${statusDot}`} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: statusColor }}>
              {status === 'running' ? 'Running' : status === 'checking' ? 'Checking...' : 'Offline'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={check} style={{ gap: 4 }}>
              <IconRefresh /> Recheck
            </button>
          </div>
        </div>

        {status === 'offline' && (
          <div style={{ marginTop: 12 }}>
            <div className="alert alert-critical mb-3" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconWarning />
                <span>Ollama is not running.</span>
              </div>
              <button
                className="btn btn-sm btn-success"
                onClick={handleStart}
                disabled={starting}
                style={{ flexShrink: 0, gap: 5 }}
              >
                {starting ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Starting...</> : <><IconPlay /> Start Ollama</>}
              </button>
            </div>
            {startError && (
              <div style={{ fontSize: 12, color: 'var(--critical)', marginTop: 6 }}>{startError}</div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Or install from{' '}
              <span
                style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => window.acm.openExternal('https://ollama.com')}
              >
                ollama.com
              </span>
            </div>
          </div>
        )}

        {status === 'running' && models.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--surface-border)', paddingTop: 16 }}>
            <div className="settings-field-label">Installed Models</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {models.map((m, i) => {
                const name = typeof m === 'string' ? m : m.name
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--surface-raised)',
                    border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)'
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{name}</span>
                    <span className="badge badge-safe">Ready</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {status === 'running' && models.length === 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            No models installed. Run{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-raised)', padding: '1px 5px', borderRadius: 3 }}>
              ollama pull qwen2.5-coder:3b
            </code>
            {' '}in your terminal.
          </div>
        )}

        {status === 'running' && models.length > 0 && currentProvider !== 'ollama' && (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleSetLocal}>
              Switch to Local Engine
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Cloud Provider Section ─────────────────────────────────────────────────────
function CloudSection({ currentConfig, onSaved }) {
  const [provider, setProvider] = useState(
    CLOUD_PROVIDERS.find(p => p.id === currentConfig.provider)?.id || 'claude'
  )
  const [model,    setModel]    = useState(currentConfig.model || '')
  const [apiKey,   setApiKey]   = useState('')
  const [hasKey,   setHasKey]   = useState(currentConfig.hasKey || false)
  const [saving,   setSaving]   = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saved,    setSaved]    = useState(false)

  const selectedProvider = CLOUD_PROVIDERS.find(p => p.id === provider)

  const handleProviderChange = (id) => {
    setProvider(id)
    const p = CLOUD_PROVIDERS.find(x => x.id === id)
    setModel(p?.models[0] || '')
    setTestResult(null)
    setSaved(false)
  }

  const handleTest = async () => {
    if (!apiKey) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${BACKEND}/api/config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, api_key: apiKey }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      setTestResult(data.ok ? 'ok' : `fail:${data.detail || 'Invalid key'}`)
    } catch (e) {
      setTestResult(`fail:${e.message}`)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const payload = { provider, model }
      if (apiKey) payload.api_key = apiKey
      const res = await fetch(`${BACKEND}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Backend error')
      setSaved(true)
      setHasKey(true)
      onSaved?.()
    } catch (e) {
      alert('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">Cloud AI Providers</div>
      <div className="settings-section-desc">
        Connect to commercial AI models. Your API key is stored locally in the backend{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-raised)', padding: '1px 4px', borderRadius: 3 }}>.env</code> file.
      </div>

      <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="alert alert-warning">
          <IconWarning />
          <span>When using Cloud mode, code snippets from scanned repositories are sent to the AI provider.</span>
        </div>

        <div>
          <div className="settings-field-label">Provider</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {CLOUD_PROVIDERS.map(p => (
              <button
                key={p.id}
                className={`btn ${provider === p.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => handleProviderChange(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {selectedProvider && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 6, fontSize: 11 }}
              onClick={() => window.acm.openExternal(selectedProvider.docsUrl)}
            >
              Get API key
            </button>
          )}
        </div>

        <div>
          <div className="settings-field-label">Model</div>
          {selectedProvider ? (
            <select
              className="form-input form-select text-mono"
              value={model}
              onChange={(e) => { setModel(e.target.value); setSaved(false) }}
              style={{ marginTop: 6 }}
            >
              {selectedProvider.models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="form-input"
              value={model}
              onChange={(e) => { setModel(e.target.value); setSaved(false) }}
              style={{ marginTop: 6, fontFamily: 'var(--font-mono)' }}
            />
          )}
        </div>

        <div>
          <div className="settings-field-label">
            API Key{' '}
            {hasKey && <span style={{ color: 'var(--safe)', fontWeight: 'normal', textTransform: 'none', letterSpacing: 'normal', fontSize: 11 }}>(key saved — enter new to replace)</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              type="password"
              className="form-input"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); setSaved(false) }}
              placeholder={hasKey ? '••••••••••••••••' : 'Paste your API key here'}
              style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
            />
            <button
              className="btn btn-secondary"
              disabled={!apiKey || testing}
              onClick={handleTest}
            >
              {testing ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> : 'Verify'}
            </button>
          </div>
          {testResult === 'ok' && (
            <div style={{ fontSize: 12, color: 'var(--safe)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCheck /> API key verified successfully
            </div>
          )}
          {testResult?.startsWith('fail:') && (
            <div style={{ fontSize: 12, color: 'var(--critical)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconX /> {testResult.replace('fail:', '')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-primary"
            disabled={saving || (!apiKey && !hasKey)}
            onClick={handleSave}
          >
            {saving ? <><span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Saving...</> : 'Save & Activate Cloud Engine'}
          </button>
          {saved && (
            <span style={{ fontSize: 12, color: 'var(--safe)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCheck /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── System Info Section ────────────────────────────────────────────────────────
function SystemSection() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState({})

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/system/tools`)
      const data = await res.json()
      setTools(data.tools || [])
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleInstall = async (toolName) => {
    setInstalling(prev => ({ ...prev, [toolName]: true }))
    try {
      const res = await fetch(`${BACKEND}/api/system/tools/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName })
      })
      const data = await res.json()
      if (data.status === 'ok') {
        await load() // Refresh tools list to see it installed
      } else {
        alert(`Failed to install ${toolName}: ${data.detail}`)
      }
    } catch (e) {
      alert(`Error installing ${toolName}: ${e.message}`)
    } finally {
      setInstalling(prev => ({ ...prev, [toolName]: false }))
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">System & Tools</div>
      <div className="settings-section-desc">
        Installed analysis tools and runtimes detected on this machine.
      </div>

      <div className="settings-card">
        {loading ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <span className="spinner" />
            Detecting tools...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {tools.map((tool, i) => (
              <div key={i} className="settings-row">
                <div>
                  <div className="settings-row-label">{tool.name}</div>
                  {tool.version && <div className="settings-row-sub">{tool.version}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge ${tool.installed ? 'badge-safe' : 'badge-critical'}`}>
                    {tool.installed ? 'Installed' : 'Not found'}
                  </span>
                  {!tool.installed && (
                    <button 
                      className="btn btn-sm btn-primary" 
                      disabled={installing[tool.name]}
                      onClick={() => handleInstall(tool.name)}
                    >
                      {installing[tool.name] ? 'Installing...' : 'Install'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Danger Zone ───────────────────────────────────────────────────────────────
function DangerSection() {
  const [confirming, setConfirming] = useState(false)

  const resetToLocal = async () => {
    try {
      await fetch(`${BACKEND}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'ollama', model: '', api_key: '' }),
      })
      window.location.reload()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }

  const rerunSetup = async () => {
    try {
      await window.acm.resetInitialized?.()
      window.location.reload()
    } catch {
      alert('Please delete the .initialized file in the Electron userData directory and relaunch.')
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title" style={{ color: 'var(--critical)' }}>Danger Zone</div>
      <div className="settings-section-desc">Irreversible actions. Be careful.</div>

      <div className="settings-card" style={{ borderColor: 'var(--critical-border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Reset Engine to Local</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Clears cloud config and switches back to Ollama.</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={resetToLocal}>Reset</button>
        </div>
        <div className="divider" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Re-run Setup Wizard</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Shows the first-run installer again on next launch.</div>
          </div>
          {!confirming ? (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>Re-run</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={rerunSetup}>Confirm</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Settings Page ─────────────────────────────────────────────────────────
export default function Settings() {
  const [currentConfig, setCurrentConfig] = useState({ provider: 'ollama', model: '', hasKey: false })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('engine')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/config/status`)
        const data = await res.json()
        setCurrentConfig({ provider: data.provider || 'ollama', model: data.model || '', hasKey: !!data.has_key })
      } catch {
        setCurrentConfig({ provider: 'ollama', model: '', hasKey: false })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title">Settings</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
          <span className="spinner" />
          Loading configuration...
        </div>
      </div>
    )
  }

  const engineLabel = currentConfig.provider === 'ollama'
    ? 'Local (Ollama)'
    : `Cloud (${currentConfig.provider})`

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-subtitle">
          Current Engine:{' '}
          <strong style={{ color: currentConfig.provider === 'ollama' ? 'var(--safe)' : 'var(--medium)' }}>
            {engineLabel}
          </strong>
          {currentConfig.model && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {currentConfig.model}</span>}
        </div>
      </div>

      <div className="tab-bar mb-8" style={{ maxWidth: 400 }}>
        <button className={`tab-item ${activeTab === 'engine'  ? 'active' : ''}`} onClick={() => setActiveTab('engine')}>AI Engine</button>
        <button className={`tab-item ${activeTab === 'system'  ? 'active' : ''}`} onClick={() => setActiveTab('system')}>System</button>
        <button className={`tab-item ${activeTab === 'danger'  ? 'active' : ''}`} onClick={() => setActiveTab('danger')}>Advanced</button>
        <button className={`tab-item ${activeTab === 'about'   ? 'active' : ''}`} onClick={() => setActiveTab('about')}>About</button>
      </div>

      {activeTab === 'engine' && (
        <>
          <OllamaSection currentProvider={currentConfig.provider} />
          <CloudSection currentConfig={currentConfig} onSaved={() => window.location.reload()} />
        </>
      )}

      {activeTab === 'system' && <SystemSection />}

      {activeTab === 'danger' && <DangerSection />}

      {activeTab === 'about' && (
        <div className="settings-section">
          <div className="settings-section-title">About</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-label">Application</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>Attack Chain Mapper</div>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">License</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>MIT — Open Source</div>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Repository</div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => window.acm.openExternal('https://github.com/Navaneethan-P/Forge')}
              >
                github.com/Navaneethan-P
              </button>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Analysis Tools</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Semgrep', 'Bandit', 'pip-audit', 'npm-audit', 'GitLeaks', 'D3.js'].map(t => (
                  <span key={t} className="badge badge-primary">{t}</span>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Privacy</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <IconShield /> No telemetry. No analytics. All data stays local by default.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
