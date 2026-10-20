import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const AGENT_COLORS = {
  0: { primary: "#60b0ff", emissive: "#1a60cc", label: "SUPERVISOR" },
  1: { primary: "#40d0ff", emissive: "#0a80a0", label: "RESEARCH" },
  2: { primary: "#8060ff", emissive: "#4020a0", label: "DATA ANALYSIS" },
  3: { primary: "#ff6080", emissive: "#a01030", label: "FACT-CHECKING" },
  4: { primary: "#40ffa0", emissive: "#0a6040", label: "WRITER" },
};

/**
 * AgentOrb — individual 3D agent entity orbiting the central core.
 *
 * Props:
 *   index        — 0..4 agent index
 *   position     — [x, y, z] in world space
 *   active       — boolean: this agent is currently executing
 *   completed    — boolean: this agent has finished
 *   idle         — boolean: no research running
 *   label        — display label override
 *   onSelect     — () => void: called when orb is clicked
 */
export function AgentOrb({
  index = 0,
  position = [2, 0, 0],
  active = false,
  completed = false,
  idle = true,
  onSelect,
}) {
  const orbRef = useRef();
  const ringRef = useRef();
  const particlesRef = useRef();
  const connectionRef = useRef();
  const t = useRef(Math.random() * Math.PI * 2); // phase offset

  const colors = AGENT_COLORS[index] ?? AGENT_COLORS[0];

  // ── Particle system (orbit particles when active) ──────────────────────
  const { particlePositions, particleCount } = useMemo(() => {
    const count = 20;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      pos[i * 3 + 0] = Math.cos(angle) * 0.28;
      pos[i * 3 + 1] = Math.sin(angle) * 0.28;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }
    return { particlePositions: pos, particleCount: count };
  }, []);

  // ── Connection line to centre ──────────────────────────────────────────
  const linePositions = useMemo(() => {
    const arr = new Float32Array(6);
    arr[0] = 0; arr[1] = 0; arr[2] = 0;
    arr[3] = -position[0]; arr[4] = -position[1]; arr[5] = -position[2];
    return arr;
  }, [position]);

  useFrame((state, delta) => {
    t.current += delta;

    // Orb hover float
    if (orbRef.current) {
      orbRef.current.position.y =
        Math.sin(t.current * 0.8 + index * 1.2) * 0.06;

      const targetScale = active ? 1.15 : completed ? 1.0 : idle ? 0.88 : 0.92;
      orbRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.06
      );

      // Emissive intensity
      if (orbRef.current.children[0]?.material) {
        const mat = orbRef.current.children[0].material;
        const targetEmissive = active ? 1.4 : completed ? 0.7 : idle ? 0.2 : 0.35;
        mat.emissiveIntensity +=
          (targetEmissive - mat.emissiveIntensity) * 0.05;
      }
    }

    // Ring pulsing
    if (ringRef.current) {
      const s = 1.0 + (active ? 0.15 : 0.04) * Math.sin(t.current * 3.2);
      ringRef.current.scale.set(s, s, 1);
      ringRef.current.material.opacity = active
        ? 0.6 + Math.sin(t.current * 4) * 0.25
        : completed
        ? 0.35
        : 0.12;
    }

    // Particles rotate when active
    if (particlesRef.current) {
      particlesRef.current.rotation.z += delta * (active ? 1.8 : completed ? 0.4 : 0.1);
      particlesRef.current.material.opacity = active ? 0.9 : completed ? 0.4 : 0.0;
    }

    // Connection line flicker
    if (connectionRef.current) {
      connectionRef.current.material.opacity = active
        ? 0.5 + Math.sin(t.current * 6) * 0.3
        : completed
        ? 0.2
        : 0.06;
    }
  });

  const color = new THREE.Color(colors.primary);
  const emissive = new THREE.Color(colors.emissive);

  return (
    <group position={position}>
      {/* Connection line to core */}
      <lineSegments ref={connectionRef} renderOrder={-1}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={linePositions}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={colors.primary}
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshBasicMaterial
          color={colors.primary}
          transparent
          opacity={active ? 0.12 : 0.04}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Main orb body */}
      <group ref={orbRef}>
        <mesh
          onClick={onSelect}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "default";
          }}
        >
          <sphereGeometry args={[0.17, 32, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={active ? 1.4 : completed ? 0.7 : 0.2}
            roughness={0.2}
            metalness={0.7}
          />
        </mesh>
      </group>

      {/* Orbital ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, index * 0.4]}>
        <ringGeometry args={[0.22, 0.26, 40]} />
        <meshBasicMaterial
          color={colors.primary}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Orbit particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={particlePositions}
            count={particleCount}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={colors.primary}
          size={0.028}
          transparent
          opacity={0.0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* Point light */}
      <pointLight
        color={colors.primary}
        intensity={active ? 1.5 : completed ? 0.6 : 0.15}
        distance={1.2}
      />

      {/* Label */}
      <Text
        position={[0, -0.32, 0]}
        fontSize={0.07}
        color={active ? "#ffffff" : completed ? colors.primary : "#556688"}
        anchorX="center"
        anchorY="top"
        font={undefined}
        letterSpacing={0.08}
      >
        {colors.label}
      </Text>

      {/* Status dot */}
      <mesh position={[0.20, 0.18, 0]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial
          color={active ? "#40ff80" : completed ? colors.primary : "#334455"}
          transparent
          opacity={active || completed ? 1.0 : 0.5}
        />
      </mesh>
    </group>
  );
}
