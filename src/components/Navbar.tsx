import { motion } from 'framer-motion'
import { Brain, Github } from 'lucide-react'

interface NavbarProps {
  onLogoClick: () => void
}

export function Navbar({ onLogoClick }: NavbarProps) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-40 px-4 md:px-8 py-4"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 group"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600
          flex items-center justify-center glow-cyan group-hover:scale-110 transition-transform">
            <Brain size={20} className="text-white" />
          </div>
          <span className="font-display font-semibold text-white text-sm md:text-base hidden sm:block">
            AI Research Agent
          </span>
        </button>

        <a
          href="https://github.com/Saran-0715/Autonomous-AI-Research-Agent"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg glass-panel
          text-slate-300 hover:text-white text-sm font-body transition-all duration-300"
        >
          <Github size={16} />
          <span className="hidden sm:inline">Repository</span>
        </a>
      </div>
    </motion.nav>
  )
}
