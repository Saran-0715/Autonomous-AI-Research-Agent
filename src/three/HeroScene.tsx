import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import {
  AICore,
  OrbitalNodes,
  KnowledgeGraph,
  CitationParticles,
} from './SceneObjects'

/**
 * Full 3D hero canvas — the cinematic research observatory backdrop.
 * Contains the holographic AI core, orbital nodes, knowledge graph,
 * and citation particles.
 */
export function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 55 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 5, 5]} intensity={0.5} color="#3b82f6" />
        <pointLight position={[-5, -3, 2]} intensity={0.3} color="#7c3aed" />

        <AICore />
        <OrbitalNodes />
        <KnowledgeGraph />
        <CitationParticles count={150} />

        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
      </Suspense>
    </Canvas>
  )
}
