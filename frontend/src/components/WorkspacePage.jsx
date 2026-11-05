import { useState, useEffect, useRef } from "react";
import { ReportPanel } from "./ReportPanel";

/* ─── Agent configuration ─────────────────────────────────────────────── */
const AGENTS = [
  {
    id: "supervisor",
    idx: 0,
    name: "Supervisor Agent",
    icon: "⬡",
    role: "Orchestrator",
    description: "Decomposes the research topic into structured subtasks and coordinates the pipeline.",
    color: "#60a5fa",         // blue
    borderColor: "rgba(96,165,250,0.35)",
    activeBg: "rgba(96,165,250,0.06)",
  },
  {
    id: "research",
    idx: 1,
    name: "Research Agent",
    icon: "⌕",
    role: "Web Intelligence",
    description: "Executes Tavily web searches and retrieves relevant source documents.",
    color: "#34d399",         // emerald
    borderColor: "rgba(52,211,153,0.35)",
    activeBg: "rgba(52,211,153,0.06)",
  },
  {
    id: "analysis",
    idx: 2,
    name: "Data Analysis Agent",
    icon: "⊹",
    role: "Pattern Extraction",
    description: "Identifies recurring themes, meaningful comparisons, and evidence-backed insights.",
    color: "#a78bfa",         // violet
    borderColor: "rgba(167,139,250,0.35)",
    activeBg: "rgba(167,139,250,0.06)",
  },
  {
    id: "fact_check",
    idx: 3,
    name: "Fact-Checking Agent",
    icon: "✦",
    role: "Verification",
    description: "Cross-references claims against collected evidence and flags unsupported statements.",
    color: "#fb923c",         // orange
    borderColor: "rgba(251,146,60,0.35)",
    activeBg: "rgba(251,146,60,0.06)",
  },
  {
    id: "writer",
    idx: 4,
    name: "Report Writer Agent",
    icon: "✎",
    role: "Synthesis",
    description: "Generates a structured final report with citations, findings, and conclusions.",
    color: "#f472b6",         // pink
    borderColor: "rgba(244,114,182,0.35)",
    activeBg: "rgba(244,114,182,0.06)",
  },
];

/* ─── Status helpers ──────────────────────────────────────────────────── */
function getAgentState(idx, activeAgent, completedAgents, job) {
  if (job.status === "failed" && activeAgent === idx) return "failed";
  if (completedAgents.has(idx)) return "completed";
  if (activeAgent === idx) return "running";
  if (activeAgent > idx || completedAgents.size > idx) return "waiting";
  return "idle";
}

function stateLabel(state) {
  return { running: "Running", completed: "Completed", failed: "Failed", waiting: "Waiting", idle: "Idle" }[state] ?? state;
}

function stateColor(state) {
  return { running: "#60a5fa", completed: "#22c55e", failed: "#f43f5e", waiting: "#64748b", idle: "#334155" }[state] ?? "#64748b";
}

/* ─── Elapsed time counter ────────────────────────────────────────────── */
function useElapsed(start) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!start) return;
    const t0 = Date.now() - (Date.now() - new Date(start).getTime());
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(start).getTime()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [start]);
  return elapsed;
}

function fmt(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/* ─── SVG connector ───────────────────────────────────────────────────── */
function Connector({ active, done, color }) {
  return (
    <div className="cc-connector">
      <div className={`cc-line ${active ? "cc-line-active" : done ? "cc-line-done" : ""}`}
        style={active || done ? { "--c-color": color } : {}} />
      <div className={`cc-arrow ${active ? "cc-arrow-active" : done ? "cc-arrow-done" : ""}`}
        style={active || done ? { "--c-color": color } : {}} />
    </div>
  );
}

/* ─── Single workflow node ────────────────────────────────────────────── */
function AgentNode({ agent, state, activeAgent, completedAgents, job, onClick, isSelected, startedAt }) {
  const elapsed = useElapsed(state === "running" ? startedAt : null);
  const isActive = state === "running";
  const isDone = state === "completed";
  const isFailed = state === "failed";
  const isIdle = state === "idle";

  const nodeStyle = {
    borderColor: isActive ? agent.borderColor : isDone ? "rgba(34,197,94,0.3)" : isFailed ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.06)",
    background: isActive ? agent.activeBg : isDone ? "rgba(34,197,94,0.04)" : "rgba(10,15,26,0.6)",
  };

  return (
    <button
      className={`cc-node ${isActive ? "cc-node-active" : ""} ${isDone ? "cc-node-done" : ""} ${isFailed ? "cc-node-failed" : ""} ${isSelected ? "cc-node-selected" : ""} ${isIdle ? "cc-node-idle" : ""}`}
      style={nodeStyle}
      onClick={onClick}
      aria-label={`${agent.name} — ${stateLabel(state)}`}
    >
      {/* Top row: icon + name + status */}
      <div className="ccn-header">
        <span className="ccn-icon" style={{ color: isActive ? agent.color : isDone ? "#22c55e" : "#334155" }}>
          {agent.icon}
        </span>
        <div className="ccn-titles">
          <span className="ccn-name">{agent.name}</span>
          <span className="ccn-role">{agent.role}</span>
        </div>
        <span className="ccn-status-badge" style={{ color: stateColor(state), borderColor: stateColor(state) + "44", background: stateColor(state) + "10" }}>
          {isActive && <span className="ccn-pulse" />}
          {stateLabel(state)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="ccn-progress-track">
        <div
          className={`ccn-progress-fill ${isActive ? "ccn-fill-animate" : ""}`}
          style={{
            width: isDone ? "100%" : isActive ? "60%" : "0%",
            background: isActive ? agent.color : isDone ? "#22c55e" : "transparent",
            opacity: isDone ? 0.7 : 1,
          }}
        />
      </div>

      {/* Activity row */}
      <div className="ccn-activity">
        <span className="ccn-activity-text">
          {isActive ? agent.description : isDone ? "Task completed successfully" : isFailed ? "Execution error — see logs" : "Waiting for upstream agent"}
        </span>
        {isActive && elapsed > 0 && (
          <span className="ccn-elapsed">{fmt(elapsed)}</span>
        )}
        {isDone && (
          <span className="ccn-elapsed done">✓ done</span>
        )}
      </div>
    </button>
  );
}

/* ─── Agent detail panel ──────────────────────────────────────────────── */
function AgentDetailPanel({ agent, state, job, onClose }) {
  const details = {
    supervisor: [
      "Analyses the research topic for scope and complexity",
      "Breaks it into 4 focused subtask queries",
      "Writes a research plan to supervisor_plan.json",
      "Signals Research Agent to begin"
    ],
    research: [
      `Executes Tavily web searches for each subtask`,
      `Collects source titles, URLs, and content snippets`,
      `Saves raw results to results.json`,
      job.source_count ? `Retrieved ${job.source_count} source documents` : "Retrieving sources…"
    ],
    analysis: [
      "Passes retrieved sources to Groq LLM",
      "Extracts recurring themes and comparisons",
      job.themes ? `Identified ${job.themes} distinct themes` : "Analysing patterns…",
      "Saves structured output to analysis.json"
    ],
    fact_check: [
      "Extracts verifiable claims from research data",
      "Cross-references claims against source evidence",
      job.claims ? `Reviewed ${job.claims} claims` : "Verifying claims…",
      "Flags unsupported or conflicting statements"
    ],
    writer: [
      "Combines all agent outputs into a coherent report",
      "Writes executive summary, findings, and citations",
      "Applies fact-check annotations to claims",
      "Saves final report to research_report.txt"
    ],
  };

  return (
    <div className="cc-detail-panel">
      <div className="cdp-header">
        <div className="cdp-top">
          <span className="cdp-icon" style={{ color: agent.color }}>{agent.icon}</span>
          <div>
            <div className="cdp-name">{agent.name}</div>
            <div className="cdp-role">{agent.role}</div>
          </div>
          <button className="cdp-close" onClick={onClose}>×</button>
        </div>
        <div className="cdp-status" style={{ color: stateColor(state) }}>
          <span className="cdp-status-dot" style={{ background: stateColor(state) }} />
          {stateLabel(state)}
        </div>
      </div>

      <div className="cdp-section-label">PURPOSE</div>
      <p className="cdp-desc">{agent.description}</p>

      <div className="cdp-section-label">EXECUTION STEPS</div>
      <ul className="cdp-steps">
        {(details[agent.id] || []).map((step, i) => (
          <li key={i} className="cdp-step">
            <span className="cdp-step-num">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ul>

      {job.error && state === "failed" && (
        <>
          <div className="cdp-section-label">ERROR</div>
          <div className="cdp-error">{job.error}</div>
        </>
      )}
    </div>
  );
}

/* ─── Live execution log ──────────────────────────────────────────────── */
function ExecutionLog({ log, job }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [log]);

  return (
    <div className="cc-exec-log" ref={ref} role="log" aria-live="polite" aria-label="Execution log">
      {log.length === 0 ? (
        <span className="cel-empty">Pipeline output will appear here…</span>
      ) : (
        log.map((entry, i) => (
          <div key={i} className="cel-entry">
            <span className="cel-text">{entry}</span>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── MAIN WORKSPACE PAGE ─────────────────────────────────────────────── */
export function WorkspacePage({ job, activeAgent, completedAgents, log, onReset }) {
  const [selectedAgentIdx, setSelectedAgentIdx] = useState(null);
  const [showReport, setShowReport] = useState(false);

  const isRunning = job.status === "running";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";

  const globalStatus = isRunning ? "Executing pipeline…"
    : isCompleted ? "Research complete"
    : isFailed ? "Pipeline failed"
    : "Queued";
  const globalStatusClass = isRunning ? "gs-running" : isCompleted ? "gs-done" : isFailed ? "gs-failed" : "gs-queued";

  function toggleAgent(idx) {
    setSelectedAgentIdx(idx === selectedAgentIdx ? null : idx);
  }

  const selectedAgent = selectedAgentIdx !== null ? AGENTS[selectedAgentIdx] : null;
  const selectedState = selectedAgent ? getAgentState(selectedAgent.idx, activeAgent, completedAgents, job) : "idle";

  return (
    <div className="cc-workspace">

      {/* ═══ HEADER ══════════════════════════════════════════════════════ */}
      <header className="cc-header">
        <div className="cch-left">
          <div className="cch-brand">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <circle cx="12" cy="12" r="4" stroke="#3b82f6" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="8.5" stroke="#3b82f6" strokeWidth="0.6" strokeDasharray="2 2" />
              <line x1="12" y1="1" x2="12" y2="4" stroke="#60a5fa" strokeWidth="1" />
              <line x1="12" y1="20" x2="12" y2="23" stroke="#60a5fa" strokeWidth="1" />
              <line x1="1" y1="12" x2="4" y2="12" stroke="#60a5fa" strokeWidth="1" />
              <line x1="20" y1="12" x2="23" y2="12" stroke="#60a5fa" strokeWidth="1" />
            </svg>
            <span>AETHER Intelligence</span>
          </div>

          <div className="cch-divider" />

          <div className="cch-task">
            <div className="cch-task-label">RESEARCH TASK</div>
            <div className="cch-task-topic" title={job.topic}>{job.topic || "—"}</div>
          </div>
        </div>

        <div className="cch-center">
          <div className={`cch-status-badge ${globalStatusClass}`}>
            <span className="cch-status-dot" />
            {globalStatus}
          </div>
          {job.source_count > 0 && (
            <div className="cch-meta-pill">
              <span>⌕</span> {job.source_count} sources
            </div>
          )}
        </div>

        <div className="cch-right">
          {isCompleted && (
            <button
              className={`cc-btn-outline ${showReport ? "active" : ""}`}
              onClick={() => setShowReport(v => !v)}
            >
              {showReport ? "Close Report" : "View Report"}
            </button>
          )}
          <button className="cc-btn-outline" onClick={onReset}>← New Research</button>
        </div>
      </header>

      {/* ═══ BODY ════════════════════════════════════════════════════════ */}
      <div className="cc-body">

        {/* ── CENTER: Workflow canvas ─────────────────────────────────── */}
        <div className="cc-main-col">

          {/* Workflow header */}
          <div className="cc-workflow-header">
            <span className="cc-section-label">AUTONOMOUS RESEARCH PIPELINE</span>
            <div className="cc-pipeline-meta">
              {completedAgents.size > 0 && (
                <span className="cc-meta-chip done">{completedAgents.size}/5 agents completed</span>
              )}
              {activeAgent >= 0 && activeAgent < 5 && (
                <span className="cc-meta-chip running">
                  <span className="chip-pulse" />
                  {AGENTS[activeAgent]?.name} executing
                </span>
              )}
            </div>
          </div>

          {/* Workflow nodes + connectors */}
          <div className="cc-workflow-canvas">
            {AGENTS.map((agent, i) => {
              const state = getAgentState(agent.idx, activeAgent, completedAgents, job);
              const isLast = i === AGENTS.length - 1;
              const prevState = i > 0 ? getAgentState(AGENTS[i - 1].idx, activeAgent, completedAgents, job) : "completed";

              return (
                <div className="cc-workflow-step" key={agent.id}>
                  <AgentNode
                    agent={agent}
                    state={state}
                    activeAgent={activeAgent}
                    completedAgents={completedAgents}
                    job={job}
                    onClick={() => toggleAgent(i)}
                    isSelected={selectedAgentIdx === i}
                    startedAt={job.created_at}
                  />
                  {!isLast && (
                    <Connector
                      active={prevState === "completed" && state === "running"}
                      done={prevState === "completed" && state === "completed"}
                      color={AGENTS[i + 1]?.color}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Error banner */}
          {isFailed && job.error && (
            <div className="cc-error-banner">
              <span>⚠</span>
              <div>
                <strong>Pipeline error</strong>
                <p>{job.error}</p>
              </div>
            </div>
          )}

          {/* Completed banner */}
          {isCompleted && (
            <div className="cc-success-banner">
              <span>✓</span>
              <div>
                <strong>Research complete</strong>
                <p>All agents finished. Click <em>View Report</em> to read the full findings.</p>
              </div>
              <button className="cc-btn-primary" onClick={() => setShowReport(true)}>
                View Report →
              </button>
            </div>
          )}

          {/* Log area */}
          <div className="cc-log-section">
            <div className="cc-section-label">LIVE EXECUTION LOG</div>
            <ExecutionLog log={log} job={job} />
          </div>
        </div>

        {/* ── RIGHT: Agent detail panel ───────────────────────────────── */}
        <div className="cc-side-col">
          {selectedAgent ? (
            <AgentDetailPanel
              agent={selectedAgent}
              state={selectedState}
              job={job}
              onClose={() => setSelectedAgentIdx(null)}
            />
          ) : (
            <div className="cc-side-placeholder">
              <div className="csp-icon">⬡</div>
              <div className="csp-label">Agent Details</div>
              <div className="csp-hint">Select any workflow node to inspect its status, purpose, and execution output.</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ REPORT OVERLAY ══════════════════════════════════════════════ */}
      {showReport && isCompleted && (
        <div className="cc-report-overlay" onClick={() => setShowReport(false)}>
          <div className="cc-report-modal" onClick={e => e.stopPropagation()}>
            <button className="cc-report-close" onClick={() => setShowReport(false)} aria-label="Close report">×</button>
            <ReportPanel jobId={job.id} topic={job.topic} />
          </div>
        </div>
      )}
    </div>
  );
}
