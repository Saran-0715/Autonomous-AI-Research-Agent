
import json
import os
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def write_status(run_dir, stage, status, error=None):
    run_dir.mkdir(parents=True, exist_ok=True)

    data = {
        "stage": stage,
        "status": status,
        "error": error,
    }

    temporary = run_dir / "status.tmp"
    temporary.write_text(
        json.dumps(data, indent=2),
        encoding="utf-8",
    )
    temporary.replace(run_dir / "status.json")


def main():
    if len(sys.argv) != 3:
        print(
            'Usage: py -m backend.worker "<run_directory>" "<topic>"'
        )
        return 2

    run_dir = Path(sys.argv[1]).resolve()
    topic = sys.argv[2].strip()

    if len(topic) < 3 or len(topic) > 300:
        print("Topic must contain between 3 and 300 characters.")
        return 2

    # Keep generated reports separate for every run.
    run_dir.mkdir(parents=True, exist_ok=True)

    # Load keys without printing their values.
    from dotenv import load_dotenv

    load_dotenv(PROJECT_ROOT / ".env")

    if not os.getenv("TAVILY_API_KEY") or not os.getenv("GROQ_API_KEY"):
        write_status(
            run_dir,
            "configuration",
            "failed",
            "Required API keys are not configured.",
        )
        return 1

    # The existing CLI asks for input(), so pass the topic through stdin.
    # Running in the run directory isolates its relative output files.
    write_status(run_dir, "research", "running")

    environment = os.environ.copy()
    environment["PYTHONUTF8"] = "1"
    environment["PYTHONPATH"] = str(PROJECT_ROOT)

    try:
        result = subprocess.run(
            [sys.executable, str(PROJECT_ROOT / "main.py")],
            input=topic + "\n",
            text=True,
            cwd=run_dir,
            env=environment,
            capture_output=True,
            timeout=1800,
            check=False,
        )

        # Keep logs private to this run; don't return them through the API.
        (run_dir / "worker_stdout.log").write_text(
            result.stdout or "",
            encoding="utf-8",
        )
        (run_dir / "worker_stderr.log").write_text(
            result.stderr or "",
            encoding="utf-8",
        )

        if result.returncode != 0:
            write_status(
                run_dir,
                "research",
                "failed",
                "The research process exited with an error. Check this run's private logs.",
            )
            return result.returncode

        # The CLI can catch internal errors and still exit successfully.
        report = run_dir / "research_report.txt"
        if not report.exists() or report.stat().st_size == 0:
            write_status(
                run_dir,
                "report",
                "failed",
                "No research report was generated. Check this run's private logs.",
            )
            return 1

        write_status(run_dir, "completed", "completed")
        return 0

    except subprocess.TimeoutExpired:
        write_status(
            run_dir,
            "research",
            "failed",
            "Research exceeded the 30-minute time limit.",
        )
        return 1
    except OSError:
        write_status(
            run_dir,
            "research",
            "failed",
            "Could not start the research process.",
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
