import { useState } from "react";
import { ResearchScene, FallbackScene } from "./ResearchScene";
import { ActivityLog } from "./ActivityLog";
import { ReportPanel } from "./ReportPanel";

/**
 * WorkspacePage — the live research workspace after a job is started.
 */
export function WorkspacePage({
  job,
  activeAgent,
  completedAgents,
  log,
  onReset,
}) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [use3D, setUse3D] = useState(true);

  const isRunning = job.status === "running";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";

  // Status label
  const statusText = isRunning
    ? "Researching…"
    : isCompleted
    ? "Research Complete"
    : isFailed
    ? "Research Failed"
    : "Queued";

  const statusClass = isRunning
    ? "ws-status-running"
    : isCompleted
    ? "ws-status-done"
    : isFailed
    ? "ws-status-failed"
    : "ws-status-queued";

  function handleSelectAgent(i) {
    setSelectedAgent(i === selectedAgent ? null : i);
  }

  return (
    <div className="workspace-page">
      {/* ── Workspace Header ────────────────────────────────────────── */}
      <header className="workspace-header">
        <div className="wh-left">
          <div className="wh-brand">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <circle cx="12" cy="12" r="4" stroke="#3b82f6" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="8.5" stroke="#3b82f6" strokeWidth="0.6" strokeDasharray="2 2" />
              <line x1="12" y1="1" x2="12" y2="4" stroke="#60a5fa" strokeWidth="1" />
              <line x1="12" y1="20" x2="12" y2="23" stroke="#60a5fa" strokeWidth="1" />
              <line x1="1" y1="12" x2="4" y2="12" stroke="#60a5fa" strokeWidth="1" />
              <line x1="20" y1="12" x2="23" y2="12" stroke="#60a5fa" strokeWidth="1" />
            </svg>
            <span>AETHER Intelligence</span>
          </div>
          <div className="wh-topic" title={job.topic}>
            {job.topic}
          </div>
        </div>

        <div className="wh-center">
          <div className={`wh-status ${statusClass}`}>
            <span className="status-dot-sm" />
            {statusText}
          </div>
          {isRunning && (
            <div className="wh-stage-label">
              {stageName(job.stage)} agent active
            </div>
          )}
        </div>

        <div className="wh-right">
          <button
            className="btn-outline"
            onClick={() => setUse3D((v) => !v)}
            aria-label="Toggle 3D view"
          >
            {use3D ? "2D View" : "3D View"}
          </button>
          {isCompleted && (
            <button
              className={`btn-outline ${showReport ? "active" : ""}`}
              onClick={() => setShowReport((v) => !v)}
            >
              {showReport ? "Hide Report" : "View Report"}
            </button>
          )}
          <button className="btn-outline" onClick={onReset}>
            ← New Research
          </button>
        </div>
      </header>

      {/* ── Main workspace layout ────────────────────────────────────── */}
      <div className="workspace-body">
        {/* Left: 3D scene */}
        <div className="ws-scene-col">
          {use3D ? (
            <ResearchScene
              activeAgent={activeAgent}
              completedAgents={completedAgents}
              isRunning={isRunning}
              onSelectAgent={handleSelectAgent}
              selectedAgent={selectedAgent}
            />
          ) : (
            <FallbackScene
              activeAgent={activeAgent}
              completedAgents={completedAgents}
              isRunning={isRunning}
              onSelectAgent={handleSelectAgent}
            />
          )}
        </div>

        {/* Right: Activity log */}
        <div className="ws-panel-col">
          <ActivityLog
            log={log}
            job={job}
            activeAgent={activeAgent}
            completedAgents={completedAgents}
          />
        </div>
      </div>

      {/* ── Report modal ─────────────────────────────────────────────── */}
      {showReport && isCompleted && (
        <div className="report-overlay" onClick={() => setShowReport(false)}>
          <div
            className="report-overlay-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="report-overlay-close"
              onClick={() => setShowReport(false)}
              aria-label="Close report"
            >
              ×
            </button>
            <ReportPanel jobId={job.id} topic={job.topic} />
          </div>
        </div>
      )}
    </div>
  );
}

function stageName(stage) {
  const map = {
    supervisor: "Supervisor",
    research: "Research",
    analysis: "Data Analysis",
    fact_check: "Fact-Checking",
    writer: "Writer",
    completed: "Writer",
  };
  return map[stage] || stage || "Unknown";
}
