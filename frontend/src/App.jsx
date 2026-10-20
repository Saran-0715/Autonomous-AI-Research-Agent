import { useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { WorkspacePage } from "./components/WorkspacePage";
import { useResearchJob } from "./hooks/useResearchJob";
import "./App.css";

export default function App() {
  const [topic, setTopic] = useState("");
  const [view, setView] = useState("landing"); // "landing" | "workspace"

  const {
    job,
    isSubmitting,
    apiOnline,
    submitJob,
    resetJob,
    log,
    activeAgent,
    completedAgents,
  } = useResearchJob();

  async function handleSubmit() {
    const trimmed = topic.trim();
    if (trimmed.length < 3) return;
    await submitJob(trimmed);
    setView("workspace");
  }

  function handleReset() {
    resetJob();
    setTopic("");
    setView("landing");
  }

  return (
    <div className="aether-app">
      {view === "landing" ? (
        <LandingPage
          topic={topic}
          setTopic={setTopic}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          apiOnline={apiOnline}
          error={job.error}
        />
      ) : (
        <WorkspacePage
          job={job}
          activeAgent={activeAgent}
          completedAgents={completedAgents}
          log={log}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
