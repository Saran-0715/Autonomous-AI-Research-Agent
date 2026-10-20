import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { EnergyCore } from "./EnergyCore";
import { Stars } from "@react-three/drei";

/**
 * LandingPage — cinematic hero with 3D energy core + research input.
 *
 * Props:
 *   topic         — string
 *   setTopic      — (s: string) => void
 *   onSubmit      — () => void
 *   isSubmitting  — boolean
 *   apiOnline     — boolean
 *   error         — string | null
 */
export function LandingPage({
  topic,
  setTopic,
  onSubmit,
  isSubmitting,
  apiOnline,
  error,
}) {
  const formRef = useRef();

  function handleSubmit(e) {
    e.preventDefault();
    if (topic.trim().length < 3) return;
    onSubmit();
  }

  return (
    <div className="landing-page">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="landing-header">
        <div className="lh-brand">
          <div className="lh-logo">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="6" stroke="#3b82f6" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="11" stroke="#3b82f6" strokeWidth="0.6" strokeDasharray="2 3" />
              <circle cx="16" cy="16" r="15" stroke="#3b82f6" strokeWidth="0.4" opacity="0.4" />
              <line x1="16" y1="1" x2="16" y2="5" stroke="#60a5fa" strokeWidth="1.2" />
              <line x1="16" y1="27" x2="16" y2="31" stroke="#60a5fa" strokeWidth="1.2" />
              <line x1="1" y1="16" x2="5" y2="16" stroke="#60a5fa" strokeWidth="1.2" />
              <line x1="27" y1="16" x2="31" y2="16" stroke="#60a5fa" strokeWidth="1.2" />
            </svg>
          </div>
          <div>
            <div className="lh-wordmark">AETHER<span>Intelligence</span></div>
          </div>
        </div>

        <nav className="lh-nav" aria-label="Primary navigation">
          <a href="#overview">Overview</a>
          <a href="#research">Research</a>
          <a href="#agents">Agents</a>
          <a href="#reports">Reports</a>
        </nav>

        <div className="lh-cta">
          <button
            className="btn-launch"
            onClick={onSubmit}
            disabled={!apiOnline || isSubmitting}
          >
            Launch Workspace
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="hero-section">
        {/* 3D Energy Core */}
        <div className="hero-core" aria-label="AETHER energy core — 3D visualization">
          <Canvas
            camera={{ position: [0, 0, 3.2], fov: 52 }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 2]}
            style={{ background: "transparent" }}
          >
            <ambientLight intensity={0.05} />
            <Suspense fallback={null}>
              <Stars radius={12} depth={40} count={800} factor={2} fade speed={0.5} />
              <EnergyCore active={false} intensity={0.72} />
            </Suspense>
          </Canvas>
        </div>

        {/* Hero copy */}
        <div className="hero-copy">
          <div className="hero-eyebrow">AUTONOMOUS RESEARCH SYSTEM</div>

          <h1 className="hero-headline">
            Research beyond<br />
            <span className="hero-headline-accent">the surface.</span>
          </h1>

          <p className="hero-description">
            Five specialized AI agents. Real web research.
            Evidence-driven intelligence.
          </p>

          <p className="hero-sub">
            AETHER coordinates research, analysis, verification, and report
            generation through a sequential multi-agent pipeline — supervised,
            grounded, and traceable.
          </p>

          {/* Research input */}
          <form className="hero-form" ref={formRef} onSubmit={handleSubmit} id="research">
            <div className="hero-input-group">
              <input
                type="text"
                className="hero-input"
                placeholder="Enter a topic to investigate…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={300}
                aria-label="Research topic"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                className="btn-start"
                disabled={isSubmitting || !apiOnline || topic.trim().length < 3}
              >
                {isSubmitting ? (
                  <span className="btn-spinner" />
                ) : null}
                {isSubmitting ? "Starting…" : "Start Research"}
              </button>
            </div>

            <div className="hero-form-meta">
              <span className="hero-char-count">{topic.length}/300</span>
              <span className={`hero-api-status ${apiOnline ? "online" : "offline"}`}>
                <span className="status-dot-sm" />
                {apiOnline ? "API Ready" : "API Offline"}
              </span>
            </div>

            {error && (
              <div className="hero-error" role="alert">{error}</div>
            )}
          </form>

          <p className="hero-example">
            e.g. "Analyze the electric vehicle market in India"
          </p>
        </div>
      </section>

      {/* ── Agent preview strip ─────────────────────────────────────── */}
      <div className="agent-strip" id="agents">
        {[
          { label: "SUPERVISOR", icon: "◈", desc: "Plans & coordinates" },
          { label: "RESEARCH", icon: "⌕", desc: "Tavily web search" },
          { label: "DATA ANALYSIS", icon: "⊞", desc: "Pattern extraction" },
          { label: "FACT-CHECKING", icon: "✓", desc: "Evidence verification" },
          { label: "WRITER", icon: "✎", desc: "Report generation" },
        ].map((a, i) => (
          <div className="agent-pill" key={i}>
            <span className="agent-pill-icon">{a.icon}</span>
            <div>
              <div className="agent-pill-label">{a.label}</div>
              <div className="agent-pill-desc">{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
