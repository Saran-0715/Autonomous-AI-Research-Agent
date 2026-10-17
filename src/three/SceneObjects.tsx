import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Central holographic AI core — a pulsating icosahedron with
 * wireframe overlay and emissive cyan-violet lighting.
 */
export function AICore() {
  const meshRef = useRef<THREE.Mesh>(null)
  const wireRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (meshRef.current) {
      meshRef.current.rotation.x = t * 0.15
      meshRef.current.rotation.y = t * 0.2
      const pulse = 1 + Math.sin(t * 2) * 0.05
      meshRef.current.scale.setScalar(pulse)
    }
    if (wireRef.current) {
      wireRef.current.rotation.x = -t * 0.1
      wireRef.current.rotation.y = -t * 0.15
      wireRef.current.scale.setScalar(1.15 + Math.sin(t * 1.5) * 0.03)
    }
    if (innerRef.current) {
      innerRef.current.rotation.x = t * 0.3
      innerRef.current.rotation.z = t * 0.25
      innerRef.current.scale.setScalar(0.5 + Math.sin(t * 3) * 0.1)
    }
  })

  return (
    <group>
      <pointLight position={[0, 0, 0]} color="#22d3ee" intensity={3} distance={8} />
      <pointLight position={[2, 1, 2]} color="#7c3aed" intensity={2} distance={6} />

      {/* Solid translucent core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={0.4}
          transparent
          opacity={0.15}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Wireframe outer shell */}
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#22d3ee"
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Inner glowing core */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.4, 0]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
      </mesh>

      {/* Glow sphere */}
      <mesh scale={1.8}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#7c3aed"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}

/**
 * Orbital research nodes — small glowing spheres circling the core
 * on tilted orbits, connected by faint lines.
 */
export function OrbitalNodes() {
  const groupRef = useRef<THREE.Group>(null)

  const orbits = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        radius: 2 + i * 0.8,
        speed: 0.3 + i * 0.1,
        tilt: (i * Math.PI) / 6,
        nodeCount: 3 + i,
        color: i % 2 === 0 ? '#06b6d4' : '#7c3aed',
      })),
    [],
  )

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      {orbits.map((orbit, oi) => (
        <OrbitRing key={oi} {...orbit} />
      ))}
    </group>
  )
}

function OrbitRing({
  radius,
  speed,
  tilt,
  nodeCount,
  color,
}: {
  radius: number
  speed: number
  tilt: number
  nodeCount: number
  color: string
}) {
  const ringRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = state.clock.getElapsedTime() * speed
    }
  })

  const nodes = useMemo(
    () =>
      Array.from({ length: nodeCount }, (_, i) => {
        const angle = (i / nodeCount) * Math.PI * 2
        return {
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
        }
      }),
    [radius, nodeCount],
  )

  return (
    <group ref={ringRef} rotation={[tilt, 0, tilt * 0.5]}>
      {/* Orbit ring line */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.01, radius + 0.01, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>

      {nodes.map((node, ni) => (
        <group key={ni} position={[node.x, 0, node.z]}>
          <mesh>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.5}
            />
          </mesh>
          <pointLight color={color} intensity={0.5} distance={2} />
        </group>
      ))}
    </group>
  )
}

/**
 * Floating 3D knowledge graph — nodes connected by edges, slowly
 * rotating in space.
 */
export function KnowledgeGraph() {
  const groupRef = useRef<THREE.Group>(null)

  const nodes = useMemo(() => {
    const positions: THREE.Vector3[] = []
    const count = 18
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      const r = 3.5 + Math.random() * 0.5
      positions.push(
        new THREE.Vector3(
          r * Math.cos(theta) * Math.sin(phi),
          r * Math.sin(theta) * Math.sin(phi),
          r * Math.cos(phi),
        ),
      )
    }
    return positions
  }, [])

  const edges = useMemo(() => {
    const pairs: [number, number][] = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].distanceTo(nodes[j]) < 2.5) {
          pairs.push([i, j])
        }
      }
    }
    return pairs
  }, [nodes])

  const edgeGeometry = useMemo(() => {
    const positions = new Float32Array(edges.length * 6)
    edges.forEach(([a, b], i) => {
      positions[i * 6] = nodes[a].x
      positions[i * 6 + 1] = nodes[a].y
      positions[i * 6 + 2] = nodes[a].z
      positions[i * 6 + 3] = nodes[b].x
      positions[i * 6 + 4] = nodes[b].y
      positions[i * 6 + 5] = nodes[b].z
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [edges, nodes])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.03
      groupRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.1
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, -2]}>
      {/* Edges */}
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial color="#06b6d4" transparent opacity={0.15} />
      </lineSegments>

      {/* Nodes */}
      {nodes.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#3b82f6' : '#7c3aed'}
            emissive={i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#3b82f6' : '#7c3aed'}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Citation particles — small particles drifting upward, representing
 * connected citations flowing through the system.
 */
export function CitationParticles({ count = 200 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 14
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8
      arr[i * 3 + 2] = (Math.random() - 0.5) * 14
    }
    return arr
  }, [count])

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.02
      const pos = pointsRef.current.geometry.attributes.position
      const arr = pos.array as Float32Array
      for (let i = 0; i < count; i++) {
        arr[i * 3 + 1] += 0.005
        if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -4
      }
      pos.needsUpdate = true
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#22d3ee"
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  )
}
