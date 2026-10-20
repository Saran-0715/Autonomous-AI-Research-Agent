import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * EnergyCore — the central glowing radial energy sphere.
 *
 * Props:
 *   active    — boolean: whether research is running (pulses faster)
 *   intensity — 0..1: overall brightness
 */
export function EnergyCore({ active = false, intensity = 0.6 }) {
  const groupRef = useRef();
  const raysMeshRef = useRef();
  const ringRef = useRef();
  const innerRingRef = useRef();
  const coreRef = useRef();
  const glowRef = useRef();

  const t = useRef(0);

  // ── Ray geometry ──────────────────────────────────────────────────────────
  const { rayPositions, rayColors, rayOpacities } = useMemo(() => {
    const count = 1200;
    const positions = new Float32Array(count * 6); // 2 vertices per ray
    const colors = new Float32Array(count * 6);
    const opacities = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      // Random direction on a disc (z=0 plane for 2D-look, slight z variation)
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const dz = (Math.random() - 0.5) * 0.08;

      // Inner radius varies: rays start just outside the core sphere
      const innerR = 0.28 + Math.random() * 0.12;
      // Outer radius: varies wildly for the "burst" look
      const outerR = innerR + 0.15 + Math.random() * 0.85;

      const base = i * 6;
      // Inner vertex
      positions[base + 0] = dx * innerR;
      positions[base + 1] = dy * innerR;
      positions[base + 2] = dz;
      // Outer vertex
      positions[base + 3] = dx * outerR;
      positions[base + 4] = dy * outerR;
      positions[base + 5] = dz;

      // Color: mix electric-blue to icy-white
      const t = Math.random();
      // Blue tones: [0.1, 0.4, 1.0] to white [0.85, 0.95, 1.0]
      const r = 0.10 + t * 0.75;
      const g = 0.40 + t * 0.55;
      const b = 1.0;

      colors[base + 0] = r;
      colors[base + 1] = g;
      colors[base + 2] = b;
      colors[base + 3] = r;
      colors[base + 4] = g;
      colors[base + 5] = b;

      opacities[i * 2 + 0] = 0.05 + Math.random() * 0.55;
      opacities[i * 2 + 1] = 0.0; // fade to transparent at tip
    }

    return {
      rayPositions: positions,
      rayColors: colors,
      rayOpacities: opacities,
    };
  }, []);

  // ── Ring geometry ──────────────────────────────────────────────────────────
  const ringGeometry = useMemo(() => {
    return new THREE.RingGeometry(1.18, 1.26, 120);
  }, []);

  const innerRingGeometry = useMemo(() => {
    return new THREE.RingGeometry(0.82, 0.86, 80);
  }, []);

  // ── Animation ──────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    t.current += delta;
    const speed = active ? 0.8 : 0.35;
    const pulse = 0.92 + Math.sin(t.current * speed * 2.1) * 0.08;
    const brightPulse = intensity * (0.85 + Math.sin(t.current * speed * 1.7) * 0.15);

    if (groupRef.current) {
      groupRef.current.rotation.z += delta * (active ? 0.06 : 0.02);
    }

    if (raysMeshRef.current) {
      raysMeshRef.current.material.opacity = brightPulse * 0.9;
      // Slow rotational drift on the ray cloud
      raysMeshRef.current.rotation.z = Math.sin(t.current * 0.13) * 0.04;
    }

    if (ringRef.current) {
      ringRef.current.material.opacity = 0.55 + Math.sin(t.current * 1.4) * 0.2;
      const s = pulse * 1.0;
      ringRef.current.scale.set(s, s, 1);
    }

    if (innerRingRef.current) {
      innerRingRef.current.material.opacity =
        0.3 + Math.sin(t.current * 1.9 + 1) * 0.15;
      innerRingRef.current.rotation.z = t.current * (active ? 0.4 : 0.15);
    }

    if (coreRef.current) {
      coreRef.current.material.emissiveIntensity =
        0.4 + Math.sin(t.current * 2.3) * 0.2;
    }

    if (glowRef.current) {
      const gs = 1.0 + Math.sin(t.current * 1.1) * 0.07;
      glowRef.current.scale.set(gs, gs, gs);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Outer glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.35, 32, 32]} />
        <meshBasicMaterial
          color="#0a1a3a"
          transparent
          opacity={0.18}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Energy rays (line segments) */}
      <lineSegments ref={raysMeshRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={rayPositions}
            count={rayPositions.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={rayColors}
            count={rayColors.length / 3}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={intensity * 0.88}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Luminous outer ring */}
      <mesh ref={ringRef}>
        <primitive object={ringGeometry} />
        <meshBasicMaterial
          color="#e8f4ff"
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner orbital ring */}
      <mesh ref={innerRingRef}>
        <primitive object={innerRingGeometry} />
        <meshBasicMaterial
          color="#4ab0ff"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Dark core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.27, 48, 48]} />
        <meshStandardMaterial
          color="#050d1a"
          emissive="#1a4080"
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Core halo */}
      <mesh>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshBasicMaterial
          color="#1060cc"
          transparent
          opacity={0.25}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Point light at center */}
      <pointLight color="#3080ff" intensity={active ? 2.5 : 1.2} distance={3} />
    </group>
  );
}
