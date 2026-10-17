export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ResearchJob {
  id: string
  query: string
  status: JobStatus
  progress: number
  error: string | null
  created_at: string
  updated_at: string
}

export interface ResearchSource {
  id: string
  job_id: string
  source_number: number
  title: string | null
  url: string | null
  content: string | null
  research_area: string | null
}

export interface ClaimEvidence {
  title?: string
  url?: string
  domain?: string
  quote?: string
  reason?: string
}

export interface FactCheckClaim {
  claim: string
  quote: string
  source_number: number | string | null
  status: string
  source_title: string
  source_url: string
  independent_status: string
  independent_evidence: ClaimEvidence[]
  independent_domains: string[]
  independent_explanation?: string
}

export interface FactCheckReport {
  note?: string
  claims: FactCheckClaim[]
  evidence_sources?: unknown[]
  error?: string
}

export interface QualityMetrics {
  total_claims: number
  single_source_claims: number
  insufficient_claims: number
  corroborated_claims: number
  unique_websites: number
  total_results: number
}

export interface QualityReport {
  metrics: QualityMetrics
  fact_check_text: string
  quality_text: string
}

export interface JobDetail extends ResearchJob {
  report_text?: string | null
  fact_check_report?: FactCheckReport | null
  quality_report?: QualityReport | null
  sources?: ResearchSource[]
}

export interface BackendConfig {
  tavily_configured: boolean
  groq_configured: boolean
  supabase_configured: boolean
}
