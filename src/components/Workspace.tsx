import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  Loader2,
  FileText,
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Activity,
  Globe,
  ShieldCheck,
  X,
} from 'lucide-react'
import type {
  BackendConfig,
  JobDetail,
  ResearchJob,
  FactCheckClaim,
} from '../types'
import { api } from '../api'

interface WorkspaceProps {
  config: BackendConfig | null
}

export function Workspace({ config }: WorkspaceProps) {
  const [query, setQuery] = useState('')
  const [jobs, setJobs] = useState<ResearchJob[]>([])
  const [activeJob, setActiveJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [pollingId, setPollingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const list = await api.listResearch()
      setJobs(list)
    } catch {
      // silent — list is non-critical
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Poll a running job until it finishes
  useEffect(() => {
    if (!pollingId) return

    pollRef.current = setInterval(async () => {
      try {
        const detail = await api.getResearch(pollingId)
        setActiveJob(detail)
        if (detail.status === 'completed' || detail.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setPollingId(null)
          fetchJobs()
        }
      } catch {
        // keep trying
      }
    }, 2000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [pollingId, fetchJobs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    if (config && !config.tavily_configured) {
      setError(
        'The research backend does not have a Tavily API key configured. Research cannot run until the server has the required API key.',
      )
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await api.startResearch(trimmed)
      setPollingId(result.job_id)
      setQuery('')

      const detail = await api.getResearch(result.job_id)
      setActiveJob(detail)
      fetchJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start research.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectJob = async (job: ResearchJob) => {
    try {
      const detail = await api.getResearch(job.id)
      setActiveJob(detail)
      if (detail.status === 'running' || detail.status === 'pending') {
        setPollingId(job.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job.')
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    try {
      await api.deleteResearch(jobId)
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
      if (activeJob?.id === jobId) setActiveJob(null)
    } catch {
      // ignore
    }
  }

  // When config is null (backend unreachable), be optimistic and let the
  // API call fail with a visible error rather than permanently disabling
  // the button. Only disable when we KNOW the keys are missing.
  const canRun = config ? config.tavily_configured && config.groq_configured : true

  return (
    <div className="relative min-h-screen pt-20 pb-12 px-4 md:px-8 grid-bg">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            Research <span className="gradient-text">Observatory</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base">
            Launch autonomous research missions. Track progress, review evidence, and read AI-generated reports.
          </p>
        </motion.div>

        {/* Config warning */}
        {config && !canRun && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-xl glass-panel border-amber-500/30 flex items-start gap-3"
          >
            <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/80">
              <p className="font-medium mb-1">Backend API keys not fully configured</p>
              <p className="text-amber-200/60">
                The server needs Tavily and Groq API keys to run research. Configure them in the
                backend's environment to enable full functionality.
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Research input + job list */}
          <div className="lg:col-span-1 space-y-6">
            <ResearchInput
              query={query}
              setQuery={setQuery}
              onSubmit={handleSubmit}
              loading={loading}
              canRun={canRun}
            />

            {error && (
              <div className="p-4 rounded-xl glass-panel border-red-500/30 flex items-start gap-3">
                <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200/80">{error}</p>
              </div>
            )}

            <JobHistory
              jobs={jobs}
              activeJobId={activeJob?.id}
              onSelect={handleSelectJob}
              onDelete={handleDeleteJob}
            />
          </div>

          {/* Right column: Job detail / analytics */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeJob ? (
                <JobDetailPanel
                  key={activeJob.id}
                  job={activeJob}
                  onShowReport={() => setShowReport(true)}
                />
              ) : (
                <EmptyState key="empty" />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Report modal */}
      <AnimatePresence>
        {showReport && activeJob && (
          <ReportModal job={activeJob} onClose={() => setShowReport(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Research Input --------------------------------------------------------

function ResearchInput({
  query,
  setQuery,
  onSubmit,
  loading,
  canRun,
}: {
  query: string
  setQuery: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  canRun: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass-panel p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Search size={18} className="text-cyber-cyan" />
        <h3 className="font-display font-semibold text-white">New Research Mission</h3>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to research?"
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-cyan-500/20
            text-white placeholder-slate-500 text-sm font-body
            focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30
            transition-all duration-300"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim() || !canRun}
          className="w-full py-3 rounded-xl font-display font-medium text-white
          bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all duration-300 flex items-center justify-center gap-2 glow-cyan"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Initiating...
            </>
          ) : (
            <>
              <Search size={18} />
              Launch Research
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-500 font-mono leading-relaxed">
        The agent will search, analyze, fact-check, and generate a report. This may take several minutes.
      </p>
    </motion.div>
  )
}

// --- Job History -----------------------------------------------------------

function JobHistory({
  jobs,
  activeJobId,
  onSelect,
  onDelete,
}: {
  jobs: ResearchJob[]
  activeJobId?: string
  onSelect: (job: ResearchJob) => void
  onDelete: (jobId: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass-panel p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Clock size={18} className="text-cyber-violet" />
        <h3 className="font-display font-semibold text-white">Research History</h3>
        <span className="ml-auto text-xs text-slate-500 font-mono">{jobs.length}</span>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">
          No research missions yet. Launch one to see it here.
        </p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`group p-3 rounded-lg cursor-pointer transition-all duration-200
              ${activeJobId === job.id ? 'bg-cyan-500/10 border border-cyan-400/30' : 'hover:bg-slate-800/40 border border-transparent'}`}
              onClick={() => onSelect(job)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`status-dot status-${job.status}`} />
                    <span className="text-xs font-mono uppercase text-slate-400">
                      {job.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 truncate font-body">{job.query}</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {new Date(job.created_at).toLocaleDateString()}{' '}
                    {new Date(job.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(job.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400
                  transition-all duration-200 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// --- Empty State -----------------------------------------------------------

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="glass-panel h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8"
    >
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20
      flex items-center justify-center mb-4 float-up">
        <Activity size={32} className="text-cyber-cyan" />
      </div>
      <h3 className="font-display text-xl font-semibold text-white mb-2">
        Awaiting Research Mission
      </h3>
      <p className="text-sm text-slate-400 max-w-sm">
        Enter a research topic and launch a mission. Results, analytics, fact-checking, and the
        generated report will appear here.
      </p>
    </motion.div>
  )
}

// --- Job Detail Panel ------------------------------------------------------

function JobDetailPanel({
  job,
  onShowReport,
}: {
  job: JobDetail
  onShowReport: () => void
}) {
  const claims: FactCheckClaim[] = job.fact_check_report?.claims ?? []
  const metrics = job.quality_report?.metrics

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Status card */}
      <div className="glass-panel p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`status-dot status-${job.status}`} />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                {job.status}
              </span>
            </div>
            <h3 className="font-display text-lg font-semibold text-white">{job.query}</h3>
          </div>

          {job.status === 'completed' && job.report_text && (
            <button
              onClick={onShowReport}
              className="px-4 py-2 rounded-lg text-sm font-display font-medium text-white
              bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500
              transition-all duration-300 flex items-center gap-2"
            >
              <Eye size={16} />
              View Report
            </button>
          )}
        </div>

        {/* Progress bar */}
        {(job.status === 'running' || job.status === 'pending') && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span>Processing...</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${job.progress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                style={{ boxShadow: '0 0 10px rgba(6, 182, 212, 0.5)' }}
              />
            </div>
          </div>
        )}

        {job.status === 'failed' && job.error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200/80">{job.error}</p>
          </div>
        )}
      </div>

      {/* Analytics */}
      {metrics && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-cyber-cyan" />
            <h3 className="font-display font-semibold text-white">Analytics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard
              icon={<FileText size={16} />}
              label="Total Results"
              value={metrics.total_results}
              color="cyan"
            />
            <MetricCard
              icon={<Globe size={16} />}
              label="Unique Websites"
              value={metrics.unique_websites}
              color="blue"
            />
            <MetricCard
              icon={<ShieldCheck size={16} />}
              label="Claims Checked"
              value={metrics.total_claims}
              color="violet"
            />
            <MetricCard
              icon={<CheckCircle2 size={16} />}
              label="Single-Source"
              value={metrics.single_source_claims}
              color="cyan"
            />
            <MetricCard
              icon={<CheckCircle2 size={16} />}
              label="Corroborated"
              value={metrics.corroborated_claims}
              color="blue"
            />
            <MetricCard
              icon={<AlertTriangle size={16} />}
              label="Insufficient"
              value={metrics.insufficient_claims}
              color="violet"
            />
          </div>
        </div>
      )}

      {/* Sources */}
      {job.sources && job.sources.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-cyber-violet" />
            <h3 className="font-display font-semibold text-white">
              Sources ({job.sources.length})
            </h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {job.sources.map((src) => (
              <SourceCard key={src.id} source={src} />
            ))}
          </div>
        </div>
      )}

      {/* Fact-check claims */}
      {claims.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={18} className="text-cyber-cyan" />
            <h3 className="font-display font-semibold text-white">
              Fact-Checked Claims ({claims.length})
            </h3>
          </div>
          <div className="space-y-3">
            {claims.map((claim, i) => (
              <ClaimCard key={i} claim={claim} index={i + 1} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// --- Small components ------------------------------------------------------

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'cyan' | 'blue' | 'violet'
}) {
  const colors = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
  }

  return (
    <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/30">
      <div className={`w-8 h-8 rounded-lg ${colors[color]} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 font-mono">{label}</p>
    </div>
  )
}

function SourceCard({ source }: { source: { title: string | null; url: string | null; research_area: string | null } }) {
  return (
    <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/20 hover:border-cyan-500/20 transition-colors">
      <p className="text-sm text-slate-200 font-body truncate">
        {source.title || 'Untitled source'}
      </p>
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cyan-400 hover:text-cyan-300 font-mono truncate block mt-1"
        >
          {source.url}
        </a>
      )}
      {source.research_area && (
        <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-mono bg-violet-500/10 text-violet-300/70">
          {source.research_area}
        </span>
      )}
    </div>
  )
}

function ClaimCard({ claim, index }: { claim: FactCheckClaim; index: number }) {
  const isCorroborated = claim.independent_status === 'CORROBORATED BY DISTINCT DOMAINS'
  const isInsufficient = claim.status === 'INSUFFICIENT EVIDENCE'
  const isFailed = claim.independent_status === 'VERIFICATION FAILED'

  const statusColor = isCorroborated
    ? 'text-emerald-400 bg-emerald-500/10'
    : isInsufficient
      ? 'text-amber-400 bg-amber-500/10'
      : isFailed
        ? 'text-red-400 bg-red-500/10'
        : 'text-cyan-400 bg-cyan-500/10'

  return (
    <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-700/20">
      <div className="flex items-start gap-3">
        <span className="text-xs font-mono text-slate-500 mt-0.5">#{index}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-100 font-body">{claim.claim}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-mono ${statusColor}`}>
              {claim.status}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800/60 text-slate-400">
              {claim.independent_status}
            </span>
          </div>
          {claim.quote && (
            <p className="text-xs text-slate-400 italic mt-2 font-body border-l border-cyan-500/20 pl-3">
              "{claim.quote}"
            </p>
          )}
          {claim.independent_domains.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {claim.independent_domains.map((d) => (
                <span
                  key={d}
                  className="px-2 py-0.5 rounded text-xs font-mono bg-blue-500/10 text-blue-300/70"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Report Modal ----------------------------------------------------------

function ReportModal({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25 }}
        className="glass-panel w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-700/30">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-cyber-cyan" />
            <h3 className="font-display font-semibold text-white">Research Report</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {job.report_text ? (
            <pre className="whitespace-pre-wrap text-sm text-slate-200 font-body leading-relaxed">
              {job.report_text}
            </pre>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">
              No report text available.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
