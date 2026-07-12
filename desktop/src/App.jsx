import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Installer from './pages/Installer'
import Shell from './components/Shell'
import Home from './pages/Home'
import Analyzer from './pages/Analyzer'
import Results from './pages/Results'
import History from './pages/History'
import Settings from './pages/Settings'
import ThreatIntel from './pages/ThreatIntel'

export default function App() {
  const [ready, setReady] = useState(false)
  const [firstRun, setFirstRun] = useState(false)

  useEffect(() => {
    const init = async () => {
      const isFirst = await window.acm.isFirstRun()
      setFirstRun(isFirst)
      setReady(true)
    }
    init()
  }, [])

  if (!ready) return null

  if (firstRun) {
    return (
      <Installer
        onComplete={() => {
          window.acm.markInitialized()
          setFirstRun(false)
        }}
      />
    )
  }

  return (
    <Shell>
      <Routes>
        <Route path="/"               element={<Home />} />
        <Route path="/analyze"        element={<Analyzer />} />
        <Route path="/results/:runId" element={<Results />} />
        <Route path="/history"        element={<History />} />
        <Route path="/threat-intel"   element={<ThreatIntel />} />
        <Route path="/settings"       element={<Settings />} />
        <Route path="/setup"          element={
          <Installer onComplete={() => window.location.href = '/'} />
        } />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
