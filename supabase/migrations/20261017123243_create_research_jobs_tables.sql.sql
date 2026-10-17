/*
# Create research jobs and sources tables (single-tenant, no auth)

1. New Tables
- `research_jobs`: stores each research run — its query, status, progress,
  generated report, fact-check report, quality dashboard, and timestamps.
- `research_sources`: stores individual search results tied to a job, with
  title, url, content snippet, and research area (task).

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD because the app is intentionally shared/public
  (no sign-in screen). All policies use `TO anon, authenticated`.

3. Notes
- `status` values: pending, running, completed, failed.
- `progress` is an integer 0–100 used to animate the UI.
- `report_text`, `fact_check_report`, `quality_report` store generated text as TEXT.
- `research_sources.job_id` references `research_jobs.id` with cascade delete.
*/

CREATE TABLE IF NOT EXISTS research_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  report_path text,
  fact_check_path text,
  quality_path text,
  report_text text,
  fact_check_report jsonb,
  quality_report jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_jobs" ON research_jobs;
CREATE POLICY "anon_select_jobs" ON research_jobs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_jobs" ON research_jobs;
CREATE POLICY "anon_insert_jobs" ON research_jobs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_jobs" ON research_jobs;
CREATE POLICY "anon_update_jobs" ON research_jobs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_jobs" ON research_jobs;
CREATE POLICY "anon_delete_jobs" ON research_jobs FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS research_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
  source_number integer NOT NULL,
  title text,
  url text,
  content text,
  research_area text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sources" ON research_sources;
CREATE POLICY "anon_select_sources" ON research_sources FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sources" ON research_sources;
CREATE POLICY "anon_insert_sources" ON research_sources FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sources" ON research_sources;
CREATE POLICY "anon_update_sources" ON research_sources FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sources" ON research_sources;
CREATE POLICY "anon_delete_sources" ON research_sources FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_research_sources_job_id ON research_sources(job_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_created_at ON research_jobs(created_at DESC);
