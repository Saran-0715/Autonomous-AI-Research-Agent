
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

const EMPTY_STATS = {
  total_runs: 0,
  completed_runs: 0,
  running_runs: 0,
  failed_runs: 0,
};

function normalizeRuns(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.runs)) return data.runs;
  return [];
}

function formatStatus(status) {
  if (!status) return "Unknown";
  return String(status).replaceAll("_", " ");
}

function StatCard({ label, value, icon, color, note }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <div className="stat-value">{value ?? 0}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}

function WorkflowStep({ number, title, description, color }) {
  return (
    <div className="workflow-step">
      <div className={`workflow-number ${color}`}>{number}</div>
      <div className="workflow-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="step-ready">READY</span>
    </div>
  );
}

export default function App() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [runs, setRuns] = useState([]);
  const [apiStatus, setApiStatus] = useState("connecting");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [selectedRun, setSelectedRun] = useState(null);
  const [report, setReport] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [researchTopic, setResearchTopic] = useState("");
  const [topicMessage, setTopicMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [healthResponse, statsResponse, runsResponse] =
          await Promise.all([
            fetch(`${API}/api/health`),
            fetch(`${API}/api/stats`),
            fetch(`${API}/api/runs`),
          ]);

        if (!healthResponse.ok || !statsResponse.ok || !runsResponse.ok) {
          throw new Error("One or more dashboard API requests failed.");
        }

        const [healthData, statsData, runsData] = await Promise.all([
          healthResponse.json(),
          statsResponse.json(),
          runsResponse.json(),
        ]);

        if (!active) return;

        setStats({ ...EMPTY_STATS, ...statsData });
        setRuns(normalizeRuns(runsData));
        setApiStatus(healthData?.status === "ok" ? "online" : "offline");
        setLastUpdated(new Date());
        setError("");
      } catch (err) {
        if (!active) return;
        setApiStatus("offline");
        setError("Unable to refresh dashboard data. Check that the backend is running.");
      }
    }

    loadDashboard();
    const interval = setInterval(loadDashboard, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function openReport(run) {
    const runId = run.id ?? run.run_id;
    if (!runId) {
      setError("This run does not expose a report ID.");
      return;
    }

    setSelectedRun(run);
    setReport("");
    setReportLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/runs/${encodeURIComponent(runId)}/report`
      );

      if (!response.ok) {
        throw new Error("The report is not available for this run.");
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        setReport(
          data.report ?? data.content ?? data.text ?? JSON.stringify(data, null, 2)
        );
      } else {
        setReport(await response.text());
      }
    } catch (err) {
      setReport(err.message || "Could not load the report.");
    } finally {
      setReportLoading(false);
    }
  }

  function closeReport() {
    setSelectedRun(null);
    setReport("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="NEXUS AI home">
          <div className="brand-mark">
            <span>N</span>
          </div>
          <div>
            <div className="brand-name">NEXUS<span>AI</span></div>
            <div className="brand-subtitle">RESEARCH INTELLIGENCE</div>
          </div>
        </a>

        <div className="nav-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          <a className="nav-item active" href="#home">
            <span className="nav-symbol">◈</span>
            Overview
          </a>
          <a className="nav-item" href="#workflow">
            <span className="nav-symbol">⌘</span>
            Workflow
          </a>
          <a className="nav-item" href="#investigations">
            <span className="nav-symbol">▤</span>
            Investigations
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-heading">
              <span className={`status-dot ${apiStatus}`} />
              <span>System status</span>
            </div>
            <strong>
              {apiStatus === "online"
                ? "All systems connected"
                : apiStatus === "offline"
                ? "Backend unavailable"
                : "Connecting to API…"}
            </strong>
            <p>Dashboard refreshes every 10 seconds.</p>
          </div>
          <div className="sidebar-footer">NEXUS AI · LOCAL WORKSPACE</div>
        </div>
      </aside>

      <main className="main-content" id="home">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Overview</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-label">LOCAL ENVIRONMENT</span>
            <div className={`connection-pill ${apiStatus}`}>
              <span className="status-dot" />
              {apiStatus === "online"
                ? "API CONNECTED"
                : apiStatus === "offline"
                ? "API OFFLINE"
                : "CONNECTING"}
            </div>
          </div>
        </header>

        <section className="welcome-section">
          <div className="welcome-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              YOUR INTELLIGENCE WORKSPACE
            </div>
            <h1>
              Research beyond
              <br />
              <span>the obvious.</span>
            </h1>
            <p>
              An autonomous research workspace to explore questions,
              organize evidence, and turn information into structured reports.
            </p>
            <a className="primary-button" href="#workflow">
              Explore workflow <span>↗</span>
            </a>
          </div>

          <div className="orb-scene" aria-label="Decorative animated AI orb">
            <div className="orb-glow" />
            <div className="orb-ring ring-one" />
            <div className="orb-ring ring-two" />
            <div className="orb-ring ring-three" />
            <div className="orb-core">
              <div className="orb-core-inner">
                <span className="orb-glyph">N</span>
                <span className="orb-core-caption">NEURAL CORE</span>
              </div>
            </div>
            <span className="orb-node node-one" />
            <span className="orb-node node-two" />
            <span className="orb-node node-three" />
            <div className="orb-tag">
              <span className="status-dot online" />
              INTELLIGENCE ENGINE
            </div>
          </div>
        </section>

        {error && (
          <div className="notice error-notice" role="status">
            <span>!</span>
            <div>{error}</div>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}

        <section className="topic-panel" id="start-research">
          <div className="section-kicker">START EXPLORING</div>
          <h2>What do you want to discover?</h2>
          <p>
            Enter a research question to launch your real NEXUS AI research pipeline.
            This uses your configured research APIs and may consume API credits.
          </p>
          <form
            className="topic-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const topic = researchTopic.trim();
              if (topic.length < 3) {
                setTopicMessage("Enter a research question with at least 3 characters.");
                return;
              }
              if (topic.length > 300) {
                setTopicMessage("Keep the topic within 300 characters.");
                return;
              }
              if (apiStatus !== "online") {
                setTopicMessage("Backend is offline. Start the FastAPI server, then try again.");
                return;
              }
              const confirmed = window.confirm(
                "Start real research for this topic? The job will use your configured APIs and may consume Tavily/Groq credits. Continue?"
              );
              if (!confirmed) return;

              setIsSubmitting(true);
              setError("");
              setTopicMessage("Submitting research job…");
              try {
                const response = await fetch(`${API}/api/runs`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ topic }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                  const detail = typeof data.detail === "string"
                    ? data.detail
                    : "The backend could not start this research job.";
                  throw new Error(detail);
                }
                setTopicMessage(
                  `Research started successfully. Run ID: ${data.id ?? data.run_id ?? "created"}. Track its progress below.`
                );
                const [statsResponse, runsResponse] = await Promise.all([
                  fetch(`${API}/api/stats`),
                  fetch(`${API}/api/runs`),
                ]);
                if (statsResponse.ok) setStats({ ...EMPTY_STATS, ...(await statsResponse.json()) });
                if (runsResponse.ok) setRuns(normalizeRuns(await runsResponse.json()));
              } catch (err) {
                setTopicMessage("");
                setError(err.message || "Could not start the research job. Check that the backend is running.");
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <textarea
              value={researchTopic}
              onChange={(event) => {
                setResearchTopic(event.target.value);
                setTopicMessage("");
              }}
              placeholder="Example: How can AI improve public services in India?"
              rows={3}
              maxLength={300}
              aria-label="Research question"
            />
            <div className="topic-form-footer">
              <span>{researchTopic.length}/300 characters</span>
              <button className="primary-button" type="submit" disabled={isSubmitting || apiStatus !== "online"}>
                {isSubmitting ? "Starting research…" : "Start research"} <span>↗</span>
              </button>
            </div>
          </form>
          {topicMessage && (
            <p className="topic-message" role="status">{topicMessage}</p>
          )}
        </section>

        <section className="stats-section" aria-label="Research statistics">
          <div className="section-title-row">
            <div>
              <div className="section-kicker">LIVE OVERVIEW</div>
              <h2>Research activity</h2>
            </div>
            <div className="updated-label">
              <span className="status-dot online" />
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}`
                : "Waiting for data"}
            </div>
          </div>

          <div className="stats-grid">
            <StatCard
              label="TOTAL RUNS"
              value={stats.total_runs}
              icon="↗"
              color="purple"
              note="All recorded investigations"
            />
            <StatCard
              label="COMPLETED"
              value={stats.completed_runs}
              icon="✓"
              color="green"
              note="Successfully completed"
            />
            <StatCard
              label="IN PROGRESS"
              value={stats.running_runs}
              icon="◷"
              color="cyan"
              note="Currently running"
            />
            <StatCard
              label="FAILED"
              value={stats.failed_runs}
              icon="!"
              color="pink"
              note="Runs needing attention"
            />
          </div>
        </section>

        <section className="workflow-panel" id="workflow">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">AUTONOMOUS PIPELINE</div>
              <h2>Research workflow</h2>
              <p>From a research question to a structured report.</p>
            </div>
            <span className="workflow-badge">
              <span className="status-dot online" />
              READY
            </span>
          </div>

          <div className="workflow-steps">
            <WorkflowStep
              number="01"
              title="Discover"
              description="Find relevant web sources"
              color="cyan"
            />
            <div className="workflow-connector" />
            <WorkflowStep
              number="02"
              title="Analyze"
              description="Extract and compare findings"
              color="purple"
            />
            <div className="workflow-connector" />
            <WorkflowStep
              number="03"
              title="Synthesize"
              description="Prepare a structured report"
              color="green"
            />
          </div>

          <div className="workflow-footnote">
            <span className="info-symbol">i</span>
Submitting a topic starts the real backend worker. Running jobs update in the activity list.
          </div>
        </section>

        <section className="investigations-section" id="investigations">
          <div className="section-title-row">
            <div>
              <div className="section-kicker">YOUR WORKSPACE</div>
              <h2>Recent investigations</h2>
            </div>
            <span className="count-badge">{runs.length} RECORDS</span>
          </div>

          {runs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⌕</div>
              <h3>No investigations yet</h3>
              <p>
                Your completed and previous research runs will appear here
                when they exist.
              </p>
              <span className="empty-state-note">
                No jobs have been started from this dashboard.
              </span>
            </div>
          ) : (
            <div className="runs-list">
              {runs.map((run, index) => {
                const runId = run.id ?? run.run_id ?? `run-${index}`;
                const status = formatStatus(run.status);

                return (
                  <article className="run-row" key={runId}>
                    <div className="run-document-icon">▤</div>
                    <div className="run-info">
                      <h3>{run.topic ?? run.query ?? runId}</h3>
                      <p>
                        {run.created_at ?? run.started_at ?? "Date unavailable"}
                      </p>
                    </div>
                    <span
                      className={`run-status ${String(status)
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                    >
                      {status}
                    </span>
                    {String(run.status).toLowerCase() === "completed" ? (
                      <button
                        className="outline-button"
                        onClick={() => openReport(run)}
                      >
                        View report ↗
                      </button>
                    ) : (
                      <span className="run-report-pending">
                        {String(run.status).toLowerCase() === "failed" ? "Report unavailable" : "Report pending"}
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="main-footer">
          <span>NEXUS AI</span>
          <span>Built for deeper discovery.</span>
          <span>LOCAL DEVELOPMENT</span>
        </footer>
      </main>

      {selectedRun && (
        <div className="modal-backdrop" onClick={closeReport}>
          <section
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="report-modal-header">
              <div>
                <div className="section-kicker">INVESTIGATION REPORT</div>
                <h2 id="report-title">
                  {selectedRun.topic ?? selectedRun.query ?? "Research report"}
                </h2>
              </div>
              <button
                className="close-button"
                onClick={closeReport}
                aria-label="Close report"
              >
                ×
              </button>
            </div>
            <div className="report-content">
              {reportLoading ? (
                <p>Loading report…</p>
              ) : (
                <pre>{report || "No report content is available."}</pre>
              )}
            </div>
            <div className="report-modal-footer">
              <button className="outline-button" onClick={closeReport}>
                Close
              </button>
              <a
                className="primary-button compact-button"
                href={`${API}/api/runs/${encodeURIComponent(
                  selectedRun.id ?? selectedRun.run_id ?? ""
                )}/report/download`}
                target="_blank"
                rel="noreferrer"
              >
                Download report ↗
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
