
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = PROJECT_ROOT / "runs"

_jobs = {}
_processes = {}
_jobs_lock = Lock()


def _read_status(run_dir):
    status_file = run_dir / "status.json"

    if not status_file.exists():
        return None

    try:
        return json.loads(status_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def create_job(topic: str) -> dict:
    topic = topic.strip()
    job_id = str(uuid4())
    run_dir = RUNS_DIR / job_id
    run_dir.mkdir(parents=True, exist_ok=False)

    job = {
        "id": job_id,
        "topic": topic,
        "status": "queued",
        "stage": "Queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "error": None,
    }

    with _jobs_lock:
        _jobs[job_id] = job

    try:
        # The worker inherits environment variables but never returns
        # its raw logs through the API.
        environment = os.environ.copy()
        environment["PYTHONUTF8"] = "1"
        environment["PYTHONPATH"] = str(PROJECT_ROOT)

        log_path = run_dir / "worker_process.log"
        log_file = log_path.open("w", encoding="utf-8")

        process = subprocess.Popen(
            [
                sys.executable,
                str(PROJECT_ROOT / "backend" / "worker.py"),
                str(run_dir),
                topic,
            ],
            cwd=run_dir,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
        )

        # Keep the log handle alive while the process runs.
        with _jobs_lock:
            _processes[job_id] = {
                "process": process,
                "log_file": log_file,
            }
            _jobs[job_id]["status"] = "running"
            _jobs[job_id]["stage"] = "Starting research"

    except OSError:
        with _jobs_lock:
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["stage"] = "Failed to start"
            _jobs[job_id]["error"] = "Could not start the research worker."

    return get_job(job_id)


def get_job(job_id: str) -> dict | None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        result = job.copy()
        process_info = _processes.get(job_id)

    run_dir = RUNS_DIR / job_id
    status_data = _read_status(run_dir)

    if status_data:
        result["stage"] = status_data.get("stage", result["stage"])
        if status_data.get("status") == "failed":
            result["status"] = "failed"
            result["error"] = status_data.get("error")
        elif status_data.get("status") == "completed":
            result["status"] = "completed"

    if process_info:
        process = process_info["process"]
        exit_code = process.poll()

        if exit_code is not None:
            process_info["log_file"].close()

            with _jobs_lock:
                _processes.pop(job_id, None)

            if exit_code != 0 and result["status"] not in ("failed", "completed"):
                result["status"] = "failed"
                result["stage"] = "Failed"
                result["error"] = "Research worker exited unexpectedly."

            with _jobs_lock:
                if job_id in _jobs:
                    _jobs[job_id].update({
                        "status": result["status"],
                        "stage": result["stage"],
                        "error": result["error"],
                    })

    return result


def list_jobs() -> list[dict]:
    with _jobs_lock:
        job_ids = list(_jobs.keys())

    jobs = [get_job(job_id) for job_id in job_ids]
    jobs = [job for job in jobs if job is not None]
    return sorted(
        jobs,
        key=lambda job: job["created_at"],
        reverse=True,
    )


def update_job(job_id: str, **changes) -> dict | None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        job.update(changes)
        return job.copy()
