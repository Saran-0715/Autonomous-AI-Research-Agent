import { useEffect, useRef, useState, useCallback } from "react";

const API = "http://127.0.0.1:8000";

const AGENT_STAGES = {
  supervisor: 0,
  research: 1,
  analysis: 2,
  fact_check: 3,
  writer: 4,
  completed: 4,
};

const STAGE_LABELS = {
  supervisor: "Supervisor",
  research: "Research",
  analysis: "Data Analysis",
  fact_check: "Fact-Checking",
  writer: "Writer",
  completed: "Completed",
};

const EMPTY_JOB = {
  id: null,
  topic: "",
  status: "idle",
  stage: "",
  agent: "",
  agent_status: "",
  source_count: 0,
  themes: 0,
  claims: 0,
  error: null,
  created_at: "",
};

/**
 * useResearchJob — manages creating a job and tracking its state via SSE.
 *
 * Returns:
 *   job          — current job state object
 *   isSubmitting — true while the POST /api/runs request is in flight
 *   apiOnline    — whether the backend health check passed
 *   submitJob    — (topic: string) => Promise<void>  — start a new job
 *   resetJob     — () => void  — go back to idle
 *   log          — string[]  — activity log entries
 *   activeAgent  — 0..4 index of the currently active agent
 *   completedAgents — Set<number>  — indices of completed agents
 */
export function useResearchJob() {
  const [job, setJob] = useState(EMPTY_JOB);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [log, setLog] = useState([]);
  const [activeAgent, setActiveAgent] = useState(-1);
  const [completedAgents, setCompletedAgents] = useState(new Set());

  const sseRef = useRef(null);
  const jobIdRef = useRef(null);
  const prevStageRef = useRef(null);

  // Health check on mount
  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then((d) => setApiOnline(d?.status === "ok"))
      .catch(() => setApiOnline(false));
  }, []);

  const addLog = useCallback((msg) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  function closeSse() {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }

  function applyUpdate(data) {
    setJob((prev) => ({ ...prev, ...data }));

    const stage = data.stage;
    const agentStatus = data.agent_status;

    // Update active / completed agents
    const agentIdx = AGENT_STAGES[stage];
    if (agentIdx !== undefined) {
      if (agentStatus === "running" || stage === agentStatus) {
        setActiveAgent(agentIdx);
      }
      if (agentStatus === "completed" || data.status === "completed") {
        setCompletedAgents((prev) => {
          const next = new Set(prev);
          if (agentIdx !== undefined) next.add(agentIdx);
          return next;
        });
      }
    }

    // Activity log — only emit when stage transitions
    const stageKey = `${stage}:${agentStatus}`;
    if (stageKey !== prevStageRef.current) {
      prevStageRef.current = stageKey;

      const label = STAGE_LABELS[stage] || stage;
      if (agentStatus === "running") {
        addLog(`${label} agent started`);
      } else if (agentStatus === "completed") {
        const extras = [];
        if (data.source_count) extras.push(`${data.source_count} sources`);
        if (data.themes) extras.push(`${data.themes} themes`);
        if (data.claims) extras.push(`${data.claims} claims`);
        addLog(`${label} agent completed${extras.length ? " — " + extras.join(", ") : ""}`);
      }
    }

    if (data.status === "completed") {
      addLog("Research pipeline complete — report ready");
      setActiveAgent(-1);
      setCompletedAgents(new Set([0, 1, 2, 3, 4]));
      closeSse();
    }

    if (data.status === "failed") {
      addLog(`Pipeline failed: ${data.error || "unknown error"}`);
      closeSse();
    }
  }

  function openSse(runId) {
    closeSse();
    const es = new EventSource(`${API}/api/runs/${runId}/stream`);

    es.onmessage = (e) => {
      try {
        applyUpdate(JSON.parse(e.data));
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener("done", (e) => {
      try {
        applyUpdate(JSON.parse(e.data));
      } catch {
        // ignore
      }
      closeSse();
    });

    es.addEventListener("error", () => {
      // SSE error — fall back to polling
      closeSse();
      startPolling(runId);
    });

    sseRef.current = es;
  }

  function startPolling(runId) {
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/runs/${runId}`);
        if (!r.ok) return;
        const data = await r.json();
        applyUpdate(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(poll);
        }
      } catch {
        // network error — keep polling
      }
    }, 3000);
  }

  const submitJob = useCallback(async (topic) => {
    if (isSubmitting) return;
    closeSse();

    setIsSubmitting(true);
    setJob({ ...EMPTY_JOB, topic, status: "queued" });
    setLog([]);
    setActiveAgent(-1);
    setCompletedAgents(new Set());
    prevStageRef.current = null;
    addLog(`Research job queued for: "${topic}"`);

    try {
      const r = await fetch(`${API}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        const detail = typeof data.detail === "string"
          ? data.detail
          : "Backend could not start this research job.";
        throw new Error(detail);
      }

      const runId = data.id ?? data.run_id;
      jobIdRef.current = runId;
      setJob((prev) => ({ ...prev, ...data, status: "running" }));
      addLog(`Job created (ID: ${runId})`);
      openSse(runId);
    } catch (err) {
      setJob((prev) => ({
        ...prev,
        status: "failed",
        error: err.message || "Failed to start research job.",
      }));
      addLog(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, addLog]);

  const resetJob = useCallback(() => {
    closeSse();
    jobIdRef.current = null;
    prevStageRef.current = null;
    setJob(EMPTY_JOB);
    setLog([]);
    setActiveAgent(-1);
    setCompletedAgents(new Set());
  }, []);

  // Cleanup on unmount
  useEffect(() => () => closeSse(), []);

  return {
    job,
    isSubmitting,
    apiOnline,
    submitJob,
    resetJob,
    log,
    activeAgent,
    completedAgents,
    API,
  };
}
