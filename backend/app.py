
import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from backend.jobs import create_job, get_job, list_jobs


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = PROJECT_ROOT / "runs"

load_dotenv(PROJECT_ROOT / ".env")

app = FastAPI(
    title="AETHER Intelligence API",
    description="Backend API for the AETHER autonomous research platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept", "Cache-Control"],
    expose_headers=["Content-Type"],
)


class ResearchRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "AETHER Intelligence API",
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


@app.get("/api/runs/{run_id}/stream")
async def stream_run_status(run_id: str):
    """
    Server-Sent Events stream for a research job.
    Sends the current status.json every 2 seconds until the job ends.
    """
    job = get_job(run_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Research run not found.")

    async def event_generator():
        last_payload = None
        ticks_without_change = 0

        while True:
            job_data = get_job(run_id)
            if job_data is None:
                yield "event: error\ndata: {\"error\": \"Job not found\"}\n\n"
                break

            # Read per-stage status from the run directory
            run_dir = RUNS_DIR / run_id
            status_file = run_dir / "status.json"
            stage_data = {}

            if status_file.exists():
                try:
                    stage_data = json.loads(
                        status_file.read_text(encoding="utf-8")
                    )
                except (OSError, json.JSONDecodeError):
                    pass

            payload = json.dumps({
                "id": run_id,
                "topic": job_data.get("topic", ""),
                "status": job_data.get("status", "running"),
                "stage": stage_data.get("stage", job_data.get("stage", "")),
                "agent": stage_data.get("agent", ""),
                "agent_status": stage_data.get("status", ""),
                "source_count": stage_data.get("source_count", 0),
                "themes": stage_data.get("themes", 0),
                "claims": stage_data.get("claims", 0),
                "error": stage_data.get("error") or job_data.get("error"),
                "created_at": job_data.get("created_at", ""),
            })

            if payload != last_payload:
                yield f"data: {payload}\n\n"
                last_payload = payload
                ticks_without_change = 0
            else:
                ticks_without_change += 1

            # Send heartbeat comment every 30 s to keep connection alive
            if ticks_without_change % 15 == 0:
                yield ": heartbeat\n\n"

            terminal = job_data.get("status") in ("completed", "failed")
            if terminal:
                # Send one final event
                yield f"event: done\ndata: {payload}\n\n"
                break

            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


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
        "supervisor_plan.json",
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
        filename="aether_research_report.txt",
    )


@app.get("/api/runs/{run_id}/{result_name}")
def get_run_result(run_id: str, result_name: str):
    filenames = {
        "results": "results.json",
        "analysis": "analysis.json",
        "fact-check": "fact_check_report.json",
        "quality": "research_quality_report.txt",
        "supervisor": "supervisor_plan.json",
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
        "completed_runs": sum(run["status"] == "completed" for run in runs),
        "running_runs": sum(
            run["status"] in ("queued", "running") for run in runs
        ),
        "failed_runs": sum(run["status"] == "failed" for run in runs),
    }
