import React, { useState, useRef, useEffect } from 'react'

const BACKEND = 'http://127.0.0.1:8000'

export default function FixItPanel({ runId, stepContext, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello. I am the Fix-It AI assistant. What do you need help with regarding this vulnerability?' }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isShapeShift, setIsShapeShift] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return
    
    const userMsg = { role: 'user', content: inputValue.trim() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInputValue('')
    setIsLoading(true)

    try {
      const res = await fetch(`${BACKEND}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: runId,
          step_context: stepContext,
          messages: updatedMessages,
        })
      })

      if (!res.ok) throw new Error('API Error')
      
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'An error occurred while connecting to the assistant.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAutoFix = async () => {
    if (isLoading) return
    setIsLoading(true)
    const modeStr = isShapeShift ? 'Shape-Shift / Moving Target Defense' : 'Standard Patch'
    const initMsg = { role: 'user', content: `Initiating Auto-Fix (${modeStr})... Please wait while I analyze and mutate the vulnerability.` }
    setMessages(prev => [...prev, initMsg])
    try {
      const res = await fetch(`${BACKEND}/api/runs/${runId}/autofix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          step_context: stepContext,
          mode: isShapeShift ? "shape_shift" : "patch"
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'API Error')
      setMessages(prev => [...prev, { role: 'assistant', content: `Auto-Fix complete! Patched code committed to local branch: \`${data.branch}\`. Push this branch to remote to open a PR.` }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Auto-Fix failed: ${e.message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div 
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
        }} 
        onClick={onClose}
      />
      <div 
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 500,
          background: 'var(--surface-void)',
          borderLeft: '1px solid var(--surface-border)',
          zIndex: 1000,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .chat-bubble {
            padding: var(--space-3) var(--space-4);
            border-radius: var(--radius-lg);
            font-size: 13px;
            line-height: 1.5;
            max-width: 85%;
            word-wrap: break-word;
          }
          .chat-bubble pre {
            background: rgba(0, 0, 0, 0.3);
            padding: var(--space-3);
            border-radius: var(--radius-md);
            overflow-x: auto;
            margin: var(--space-2) 0;
            border: 1px solid var(--surface-border);
            font-family: var(--font-mono);
            font-size: 11px;
          }
          .chat-bubble code {
            font-family: var(--font-mono);
            background: rgba(0, 0, 0, 0.2);
            padding: 2px 4px;
            border-radius: 4px;
          }
        `}</style>
        
        {/* Header */}
        <div style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--surface-border)',
          background: 'var(--surface-base)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Fix-It AI</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Context: {stepContext.node}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isShapeShift} 
                onChange={(e) => setIsShapeShift(e.target.checked)} 
                disabled={isLoading}
              />
              Shape-Shift (MTD)
            </label>
            <button className="btn btn-sm btn-primary" onClick={handleAutoFix} disabled={isLoading}>
              Auto-Fix & Branch
            </button>
            <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-5)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-4)'
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div 
                className="chat-bubble"
                style={{
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-raised)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                  borderBottomRightRadius: m.role === 'user' ? 2 : 'var(--radius-lg)',
                  borderBottomLeftRadius: m.role === 'assistant' ? 2 : 'var(--radius-lg)',
                }}
              >
                {/* Basic markdown parsing for code blocks - a real app would use react-markdown */}
                {m.content.split('```').map((part, index) => {
                  if (index % 2 === 1) {
                    // This is a code block. Remove the language identifier if present
                    const code = part.replace(/^[\w-]+\n/, '');
                    return <pre key={index}><code>{code}</code></pre>;
                  }
                  return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
                })}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div className="chat-bubble" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--surface-border)',
          background: 'var(--surface-base)'
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
              placeholder="Ask for a code fix..."
              style={{
                flex: 1,
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--surface-void)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                outline: 'none',
              }}
            />
            <button 
              className="btn btn-primary" 
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
