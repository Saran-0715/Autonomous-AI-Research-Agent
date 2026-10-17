import type {
  BackendConfig,
  JobDetail,
  ResearchJob,
  ResearchSource,
} from './types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, options)
  } catch {
    throw new Error(
      'Cannot reach the research backend server. Make sure the FastAPI server (api_server.py) is running on port 8000.',
    )
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      if (body?.detail) message = body.detail
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  getConfig: () => request<BackendConfig>('/api/config'),

  startResearch: (query: string) =>
    request<{ job_id: string; status: string; query: string }>('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }),

  getResearch: (jobId: string) => request<JobDetail>(`/api/research/${jobId}`),

  listResearch: () => request<ResearchJob[]>('/api/research'),

  getReport: (jobId: string) =>
    request<{ report_text: string }>(`/api/research/${jobId}/report`),

  getSources: (jobId: string) =>
    request<ResearchSource[]>(`/api/research/${jobId}/sources`),

  deleteResearch: (jobId: string) =>
    request<{ status: string }>(`/api/research/${jobId}`, {
      method: 'DELETE',
    }),
}
