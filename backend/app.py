
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.jobs import create_job, get_job, list_jobs


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = PROJECT_ROOT / "runs"

load_dotenv(PROJECT_ROOT / ".env")

app = FastAPI(
    title="Autonomous AI Research Agent API",
    description="Backend API for the AI research dashboard",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ResearchRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "Autonomous AI Research Agent API",
    }


@app.get("/api/config/status")
def config_status():
    return {
        "tavily_configured": bool(os.getenv("TAVILY_API_KEY")),
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
    }


@app.post("/api/runs", status_code=202)
def start_research(request: ResearchRequest):
    topic = request.topic.strip()

    if len(topic) < 3:
        raise HTTPException(
            status_code=422,
            detail="Topic must contain at least 3 non-space characters.",
        )

    return create_job(topic)


@app.get("/api/runs")
def get_research_runs():
    return {"runs": list_jobs()}


@app.get("/api/runs/{run_id}")
def get_research_run(run_id: str):
    job = get_job(run_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Research run not found.",
        )

    return job


def find_run_file(run_id: str, filename: str) -> Path:
    # Only allow a run ID that exists in the backend's job history.
    job = get_job(run_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Research run not found.")

    run_dir = (RUNS_DIR / run_id).resolve()

    if not run_dir.is_relative_to(RUNS_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Invalid run ID.")

    allowed_files = {
        "results.json",
        "analysis.json",
        "fact_check_report.json",
        "research_quality_report.txt",
        "research_report.txt",
        "citation_quality_report.txt",
    }

    if filename not in allowed_files:
        raise HTTPException(status_code=404, detail="File not found.")

    file_path = run_dir / filename

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="This result is not available yet.",
        )

    return file_path


@app.get("/api/runs/{run_id}/report")
def get_report(run_id: str):
    path = find_run_file(run_id, "research_report.txt")
    return {"run_id": run_id, "report": path.read_text(encoding="utf-8")}


@app.get("/api/runs/{run_id}/report/download")
def download_report(run_id: str):
    path = find_run_file(run_id, "research_report.txt")
    return FileResponse(
        path,
        media_type="text/plain",
        filename="research_report.txt",
    )


@app.get("/api/runs/{run_id}/{result_name}")
def get_run_result(run_id: str, result_name: str):
    filenames = {
        "results": "results.json",
        "analysis": "analysis.json",
        "fact-check": "fact_check_report.json",
        "quality": "research_quality_report.txt",
        "citation-validation": "citation_quality_report.txt",
    }

    filename = filenames.get(result_name)

    if filename is None:
        raise HTTPException(status_code=404, detail="Unknown result type.")

    path = find_run_file(run_id, filename)

    if path.suffix == ".json":
        try:
            content = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail="The result file is invalid.",
            )
        return {"run_id": run_id, "result": content}

    return {
        "run_id": run_id,
        "result": path.read_text(encoding="utf-8"),
    }


@app.get("/api/stats")
def get_stats():
    runs = list_jobs()

    return {
        "total_runs": len(runs),
        "completed_runs": sum(
            run["status"] == "completed" for run in runs
        ),
        "running_runs": sum(
            run["status"] in ("queued", "running") for run in runs
        ),
        "failed_runs": sum(
            run["status"] == "failed" for run in runs
        ),
    }
