import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import type { BackendConfig } from './types'
import { api } from './api'

const Workspace = lazy(() =>
  import('./components/Workspace').then((m) => ({ default: m.Workspace })),
)

export default function App() {
  const [showWorkspace, setShowWorkspace] = useState(false)
  const [config, setConfig] = useState<BackendConfig | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  const handleExplore = () => {
    setShowWorkspace(true)
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleLogoClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setShowWorkspace(false)
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-slate-100">
      <Navbar onLogoClick={handleLogoClick} />
      <Hero onExplore={handleExplore} />

      {showWorkspace && (
        <div ref={workspaceRef}>
          <Suspense fallback={null}>
            <Workspace config={config} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
