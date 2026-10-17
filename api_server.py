"""
FastAPI backend for the Autonomous AI Research Agent.

Wraps the existing research agents (main, fact_checking, writer, data_analysis)
into REST endpoints. Research jobs run in background threads and persist
results to Supabase. API keys are never exposed to the frontend.
"""

import os
import re
import json
import time
import logging
import threading
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from tavily import TavilyClient

from data_analysis_agent import analyze_research
from fact_checking_agent import fact_check_research
from writer_agent import write_report

# --- Configuration ---------------------------------------------------------

load_dotenv()

logging.basicConfig(
    filename="research_agent.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    encoding="utf-8",
)

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("VITE_SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

app = FastAPI(title="Autonomous AI Research Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Supabase helper (REST, no SDK dependency required) --------------------

try:
    from supabase import create_client

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)  # type: ignore[arg-type]
except Exception as exc:  # pragma: no cover
    logging.warning("Supabase client init failed: %s", exc)
    supabase = None  # type: ignore[assignment]


# --- Models ----------------------------------------------------------------


class ResearchRequest(BaseModel):
    query: str


class JobStatus(BaseModel):
    id: str
    query: str
    status: str
    progress: int
    error: str | None = None
    created_at: str
    updated_at: str


# --- Job persistence helpers -----------------------------------------------


def _insert_job(query: str) -> dict[str, Any] | None:
    if supabase is None:
        return None
    result = supabase.table("research_jobs").insert(
        {"query": query, "status": "pending", "progress": 0}
    ).execute()
    return result.data[0] if result.data else None


def _update_job(job_id: str, updates: dict[str, Any]) -> None:
    if supabase is None:
        return
    updates["updated_at"] = "now()"
    supabase.table("research_jobs").update(updates).eq("id", job_id).execute()


def _insert_sources(job_id: str, results: list[dict]) -> None:
    if supabase is None or not results:
        return
    rows = []
    for index, result in enumerate(results, start=1):
        rows.append(
            {
                "job_id": job_id,
                "source_number": index,
                "title": str(result.get("title", "Untitled source")),
                "url": str(result.get("url", "")),
                "content": str(result.get("content", ""))[:2000],
                "research_area": str(result.get("task", "Unknown")),
            }
        )
    supabase.table("research_sources").insert(rows).execute()


def _get_job(job_id: str) -> dict[str, Any] | None:
    if supabase is None:
        return None
    result = supabase.table("research_jobs").select("*").eq("id", job_id).execute()
    return result.data[0] if result.data else None


def _get_sources(job_id: str) -> list[dict[str, Any]]:
    if supabase is None:
        return []
    result = (
        supabase.table("research_sources")
        .select("*")
        .eq("job_id", job_id)
        .order("source_number")
        .execute()
    )
    return result.data if result.data else []


# --- Research pipeline (runs in background thread) -------------------------


def _run_research_pipeline(job_id: str, query: str) -> None:
    """
    Execute the full research pipeline in a background thread.

    Steps mirror the original main.py flow:
      1. Supervisor creates sub-tasks
      2. Research agent searches via Tavily
      3. Data analysis agent summarizes
      4. Fact-checking agent verifies claims
      5. Writer agent generates the report
    """

    logging.info("Starting research job %s for query: %s", job_id, query)

    try:
        _update_job(job_id, {"status": "running", "progress": 5})

        # 1. Supervisor agent — decompose into sub-tasks
        tasks = [
            f"{query} - Current market trends",
            f"{query} - Major companies and competitors",
            f"{query} - Market challenges",
            f"{query} - Future opportunities",
        ]

        _update_job(job_id, {"progress": 10})

        # 2. Research agent — search via Tavily
        tavily_key = os.getenv("TAVILY_API_KEY")
        if not tavily_key:
            raise RuntimeError("TAVILY_API_KEY is not configured on the server.")

        client = TavilyClient(api_key=tavily_key)
        research_results: list[dict] = []

        for task_index, task in enumerate(tasks):
            for attempt in range(1, 4):
                try:
                    response = client.search(query=task, max_results=3)
                    results = response.get("results", [])
                    for result in results:
                        result["task"] = task
                        research_results.append(result)
                    break
                except Exception as exc:
                    logging.warning("Search attempt %d failed for '%s': %s", attempt, task, exc)
                    if attempt < 3:
                        time.sleep(2)
                    else:
                        raise

            _update_job(
                job_id,
                {"progress": 10 + int((task_index + 1) / len(tasks) * 30)},
            )

        if not research_results:
            raise RuntimeError("No research results were collected.")

        _insert_sources(job_id, research_results)
        _update_job(job_id, {"progress": 45})

        # 3. Data analysis agent
        analyze_research(research_results)
        _update_job(job_id, {"progress": 55})

        # 4. Fact-checking agent
        fact_check_report = fact_check_research(research_results)
        if not isinstance(fact_check_report, dict):
            fact_check_report = {"claims": [], "evidence_sources": []}

        _update_job(
            job_id,
            {"progress": 80, "fact_check_report": fact_check_report},
        )

        # 5. Writer agent — generate the report
        write_report(query, research_results, fact_check_report)
        _update_job(job_id, {"progress": 90})

        # Read generated reports from disk
        report_text = ""
        fact_check_text = ""
        quality_text = ""

        report_path = Path("research_report.txt")
        if report_path.exists():
            report_text = report_path.read_text(encoding="utf-8")

        fact_check_path = Path("fact_check_report.txt")
        if fact_check_path.exists():
            fact_check_text = fact_check_path.read_text(encoding="utf-8")

        quality_path = Path("research_quality_report.txt")
        if quality_path.exists():
            quality_text = quality_path.read_text(encoding="utf-8")

        # Compute quality metrics for the frontend dashboard
        claims = fact_check_report.get("claims", [])
        total_claims = len(claims)
        single_source = sum(
            1 for c in claims if isinstance(c, dict) and c.get("status") == "SINGLE-SOURCE EVIDENCE"
        )
        insufficient = sum(
            1 for c in claims if isinstance(c, dict) and c.get("status") == "INSUFFICIENT EVIDENCE"
        )
        corroborated = sum(
            1
            for c in claims
            if isinstance(c, dict)
            and c.get("independent_status") == "CORROBORATED BY DISTINCT DOMAINS"
        )

        quality_metrics = {
            "total_claims": total_claims,
            "single_source_claims": single_source,
            "insufficient_claims": insufficient,
            "corroborated_claims": corroborated,
            "unique_websites": len({r.get("url", "") for r in research_results if r.get("url")}),
            "total_results": len(research_results),
        }

        _update_job(
            job_id,
            {
                "status": "completed",
                "progress": 100,
                "report_text": report_text,
                "fact_check_report": fact_check_report,
                "quality_report": {
                    "metrics": quality_metrics,
                    "fact_check_text": fact_check_text,
                    "quality_text": quality_text,
                },
            },
        )

        logging.info("Research job %s completed successfully", job_id)

    except Exception as exc:
        logging.exception("Research job %s failed", job_id)
        _update_job(job_id, {"status": "failed", "progress": 0, "error": str(exc)})


# --- API endpoints ---------------------------------------------------------


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/config")
def config() -> dict[str, bool]:
    """Tell the frontend whether the backend has API keys configured."""
    return {
        "tavily_configured": bool(os.getenv("TAVILY_API_KEY")),
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "supabase_configured": supabase is not None,
    }


@app.post("/api/research")
def start_research(req: ResearchRequest) -> dict[str, Any]:
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    if not os.getenv("TAVILY_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="TAVILY_API_KEY is not configured on the server. Research cannot run.",
        )

    job = _insert_job(query)
    if job is None:
        raise HTTPException(
            status_code=503,
            detail="Could not create research job. Database unavailable.",
        )

    job_id = job["id"]
    thread = threading.Thread(
        target=_run_research_pipeline, args=(job_id, query), daemon=True
    )
    thread.start()

    return {"job_id": job_id, "status": "pending", "query": query}


@app.get("/api/research/{job_id}")
def get_research(job_id: str) -> dict[str, Any]:
    job = _get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    sources = _get_sources(job_id)
    job["sources"] = sources
    return job


@app.get("/api/research")
def list_research() -> list[dict[str, Any]]:
    if supabase is None:
        return []
    result = (
        supabase.table("research_jobs")
        .select("id, query, status, progress, error, created_at, updated_at")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data if result.data else []


@app.get("/api/research/{job_id}/report")
def get_report(job_id: str) -> dict[str, str]:
    job = _get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {"report_text": job.get("report_text") or ""}


@app.get("/api/research/{job_id}/sources")
def get_job_sources(job_id: str) -> list[dict[str, Any]]:
    return _get_sources(job_id)


@app.delete("/api/research/{job_id}")
def delete_research(job_id: str) -> dict[str, str]:
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    supabase.table("research_jobs").delete().eq("id", job_id).execute()
    return {"status": "deleted"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
