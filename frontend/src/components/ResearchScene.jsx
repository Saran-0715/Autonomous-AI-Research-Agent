import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EnergyCore } from "./EnergyCore";
import { AgentOrb } from "./AgentOrb";
import * as THREE from "three";

// Pentagonal positions for the 5 agents (radius ≈ 1.9)
const AGENT_POSITIONS = [
  [0, 1.9, 0],                                   // Top — Supervisor
  [1.81, 0.59, 0],                               // Upper right — Research
  [1.12, -1.54, 0],                              // Lower right — Data Analysis
  [-1.12, -1.54, 0],                             // Lower left — Fact-Checking
  [-1.81, 0.59, 0],                              // Upper left — Writer
];

const AGENT_CONFIGS = [
  { name: "Supervisor", purpose: "Coordinates the research plan and tasks" },
  { name: "Research", purpose: "Searches the web with Tavily" },
  { name: "Data Analysis", purpose: "Extracts patterns and insights" },
  { name: "Fact-Checking", purpose: "Verifies claims against evidence" },
  { name: "Writer", purpose: "Generates the final structured report" },
];

/**
 * ResearchScene — the full 3D workspace canvas.
 */
export function ResearchScene({
  activeAgent = -1,
  completedAgents = new Set(),
  isRunning = false,
  onSelectAgent,
  selectedAgent = null,
}) {
  const idle = activeAgent === -1 && completedAgents.size === 0;
  const coreIntensity = isRunning ? 1.0 : idle ? 0.5 : 0.75;

  return (
    <div className="scene-canvas-wrapper">
      <Canvas
        camera={{ position: [0, 0, 4.8], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["#030303"]} />
        <ambientLight intensity={0.08} />
        <directionalLight position={[0, 5, 3]} intensity={0.3} color="#8ab0ff" />

        <Suspense fallback={null}>
          <Stars
            radius={18}
            depth={50}
            count={1200}
            factor={2}
            saturation={0}
            fade
            speed={0.3}
          />

          {/* Central energy core */}
          <EnergyCore active={isRunning} intensity={coreIntensity} />

          {/* Five agent orbs */}
          {AGENT_POSITIONS.map((pos, i) => (
            <AgentOrb
              key={i}
              index={i}
              position={pos}
              active={activeAgent === i}
              completed={completedAgents.has(i)}
              idle={idle}
              onSelect={() => onSelectAgent?.(i)}
            />
          ))}
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI * 3 / 4}
          rotateSpeed={0.35}
          autoRotate={idle}
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* Agent inspection panel (rendered in DOM, not in 3D) */}
      {selectedAgent !== null && (
        <AgentInfoPanel
          index={selectedAgent}
          active={activeAgent === selectedAgent}
          completed={completedAgents.has(selectedAgent)}
          onClose={() => onSelectAgent?.(null)}
        />
      )}
    </div>
  );
}

function AgentInfoPanel({ index, active, completed, onClose }) {
  const cfg = AGENT_CONFIGS[index];
  if (!cfg) return null;

  const statusText = active ? "Executing" : completed ? "Completed" : "Standby";
  const statusClass = active ? "status-active" : completed ? "status-done" : "status-idle";

  return (
    <div className="agent-info-panel" role="dialog" aria-label={`${cfg.name} details`}>
      <button className="agent-info-close" onClick={onClose} aria-label="Close panel">×</button>
      <div className="agent-info-index">AGENT {String(index + 1).padStart(2, "0")}</div>
      <h3 className="agent-info-name">{cfg.name}</h3>
      <p className="agent-info-purpose">{cfg.purpose}</p>
      <div className={`agent-info-status ${statusClass}`}>
        <span className="status-dot-sm" />
        {statusText}
      </div>
    </div>
  );
}

/**
 * FallbackScene — CSS-only fallback for low-end devices.
 */
export function FallbackScene({ activeAgent, completedAgents, isRunning, onSelectAgent }) {
  const idle = activeAgent === -1 && completedAgents.size === 0;

  return (
    <div className="fallback-scene">
      <div className={`fallback-core ${isRunning ? "running" : ""}`}>
        <div className="fallback-ring r1" />
        <div className="fallback-ring r2" />
        <div className="fallback-ring r3" />
        <div className="fallback-center" />
      </div>
      <div className="fallback-agents">
        {AGENT_CONFIGS.map((cfg, i) => (
          <button
            key={i}
            className={`fallback-agent ${activeAgent === i ? "active" : ""} ${completedAgents.has(i) ? "done" : ""} ${idle ? "idle" : ""}`}
            onClick={() => onSelectAgent?.(i)}
          >
            <span className="fallback-agent-dot" />
            {cfg.name}
          </button>
        ))}
      </div>
    </div>
  );
}
