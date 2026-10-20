
import json
import logging
import os
import sys
import time
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def write_status(run_dir: Path, stage: str, status: str, error: str | None = None,
                 extra: dict | None = None) -> None:
    """Atomically write status.json to the run directory."""
    run_dir.mkdir(parents=True, exist_ok=True)

    data: dict = {
        "stage": stage,
        "status": status,
        "error": error,
    }
    if extra:
        data.update(extra)

    tmp = run_dir / "status.tmp"
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(run_dir / "status.json")


def main() -> int:
    if len(sys.argv) != 3:
        print('Usage: py -m backend.worker "<run_directory>" "<topic>"')
        return 2

    run_dir = Path(sys.argv[1]).resolve()
    topic = sys.argv[2].strip()

    if len(topic) < 3 or len(topic) > 300:
        print("Topic must contain between 3 and 300 characters.")
        return 2

    run_dir.mkdir(parents=True, exist_ok=True)

    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")

    if not os.getenv("TAVILY_API_KEY") or not os.getenv("GROQ_API_KEY"):
        write_status(run_dir, "configuration", "failed",
                     "Required API keys are not configured.")
        return 1

    # ── Stage order: supervisor → research → analysis → fact_check → writer ──
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONPATH"] = str(PROJECT_ROOT)
    env["AETHER_RUN_DIR"] = str(run_dir)   # tells main.py where to write status

    write_status(run_dir, "supervisor", "running",
                 extra={"agent": "supervisor", "source_count": 0})

    import subprocess
    try:
        result = subprocess.run(
            [sys.executable, str(PROJECT_ROOT / "main.py")],
            input=topic + "\n",
            text=True,
            cwd=run_dir,
            env=env,
            capture_output=True,
            timeout=1800,
            check=False,
        )

        (run_dir / "worker_stdout.log").write_text(result.stdout or "", encoding="utf-8")
        (run_dir / "worker_stderr.log").write_text(result.stderr or "", encoding="utf-8")

        if result.returncode != 0:
            write_status(run_dir, "research", "failed",
                         "The research process exited with an error.")
            return result.returncode

        report = run_dir / "research_report.txt"
        if not report.exists() or report.stat().st_size == 0:
            write_status(run_dir, "writer", "failed",
                         "No research report was generated.")
            return 1

        write_status(run_dir, "completed", "completed",
                     extra={"agent": "writer"})
        return 0

    except subprocess.TimeoutExpired:
        write_status(run_dir, "research", "failed",
                     "Research exceeded the 30-minute time limit.")
        return 1
    except OSError:
        write_status(run_dir, "research", "failed",
                     "Could not start the research process.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
