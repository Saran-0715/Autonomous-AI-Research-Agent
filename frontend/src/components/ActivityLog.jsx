/**
 * ActivityLog — timeline of agent stage events.
 */
export function ActivityLog({ log, job, activeAgent, completedAgents }) {
  const STAGES = [
    { key: "supervisor", label: "Supervisor", idx: 0 },
    { key: "research", label: "Research", idx: 1 },
    { key: "analysis", label: "Data Analysis", idx: 2 },
    { key: "fact_check", label: "Fact-Checking", idx: 3 },
    { key: "writer", label: "Writer", idx: 4 },
  ];

  return (
    <div className="activity-log">
      <div className="al-header">
        <span className="al-title">PIPELINE STAGES</span>
        {job?.source_count > 0 && (
          <span className="al-sources">
            {job.source_count} sources retrieved
          </span>
        )}
      </div>

      {/* Stage pipeline */}
      <div className="al-pipeline">
        {STAGES.map((stage) => {
          const isActive = activeAgent === stage.idx;
          const isDone = completedAgents.has(stage.idx);
          const isPending = !isActive && !isDone;
          const stateClass = isActive ? "stage-active" : isDone ? "stage-done" : "stage-pending";

          return (
            <div className={`al-stage ${stateClass}`} key={stage.key}>
              <div className="als-icon">
                {isDone ? "✓" : isActive ? <span className="als-pulse" /> : "○"}
              </div>
              <div className="als-info">
                <div className="als-label">{stage.label}</div>
                <div className="als-state">
                  {isActive ? "Executing…" : isDone ? "Completed" : "Waiting"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity feed */}
      <div className="al-feed-header">ACTIVITY FEED</div>
      <div className="al-feed" role="log" aria-live="polite">
        {log.length === 0 ? (
          <div className="al-empty">No activity yet</div>
        ) : (
          log.map((entry, i) => (
            <div className="al-entry" key={i}>
              {entry}
            </div>
          ))
        )}
      </div>

      {/* Error display */}
      {job?.error && (
        <div className="al-error" role="alert">
          <span>⚠</span> {job.error}
        </div>
      )}
    </div>
  );
}
