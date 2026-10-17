import { motion } from 'framer-motion'
import { ArrowDown, Sparkles } from 'lucide-react'
import { HeroScene } from '../three/HeroScene'

interface HeroProps {
  onExplore: () => void
}

export function Hero({ onExplore }: HeroProps) {
  return (
    <section className="relative h-screen w-full overflow-hidden grid-bg">
      {/* 3D Canvas backdrop */}
      <div className="absolute inset-0">
        <HeroScene />
      </div>

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(2, 6, 23, 0.6) 70%, rgba(2, 6, 23, 0.95) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel"
        >
          <Sparkles size={14} className="text-cyber-cyan" />
          <span className="text-xs font-mono tracking-widest text-cyan-300/80 uppercase">
            Autonomous Research Intelligence
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight"
        >
          <span className="gradient-text glow-text">Research Beyond</span>
          <br />
          <span className="text-white">the Known</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-6 max-w-2xl text-base md:text-lg text-slate-300/80 font-body"
          style={{ lineHeight: '1.6' }}
        >
          Discover, verify, analyze, and transform information into knowledge.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.1 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={onExplore}
            className="group relative px-8 py-4 rounded-xl font-display font-medium text-white
            bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500
            transition-all duration-300 glow-cyan"
          >
            <span className="relative z-10 flex items-center gap-2">
              Enter Research Observatory
              <ArrowDown size={18} className="group-hover:translate-y-1 transition-transform" />
            </span>
          </button>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyber-bg to-transparent pointer-events-none" />

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none"
      >
        <div className="w-px h-12 bg-gradient-to-b from-cyan-400/50 to-transparent" />
      </motion.div>
    </section>
  )
}
