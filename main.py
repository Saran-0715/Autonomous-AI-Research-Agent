import os
import json
import time
import logging
from pathlib import Path
from dotenv import load_dotenv
from tavily import TavilyClient

from data_analysis_agent import analyze_research
from fact_checking_agent import fact_check_research
from writer_agent import write_report


# ── Per-run status writer ──────────────────────────────────────────────────
def _status(stage: str, status: str, error: str | None = None, **extra) -> None:
    """Write status.json to AETHER_RUN_DIR (set by the worker) or CWD."""
    run_dir = Path(os.environ.get("AETHER_RUN_DIR", ".")).resolve()
    run_dir.mkdir(parents=True, exist_ok=True)

    data = {"stage": stage, "status": status, "error": error}
    data.update(extra)

    tmp = run_dir / "status.tmp"
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(run_dir / "status.json")


def main():
    load_dotenv()

    logging.basicConfig(
        filename="research_agent.log",
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        encoding="utf-8"
    )

    print("=== AETHER INTELLIGENCE RESEARCH PIPELINE ===")

    question = input("\nWhat do you want to research? ").strip()

    if not question:
        print("Please enter a research topic.")
        return

    api_key = os.getenv("TAVILY_API_KEY")

    if not api_key:
        _status("configuration", "failed", "TAVILY_API_KEY not configured.")
        print("TAVILY_API_KEY not found. Check your .env file.")
        return

    # ── STAGE 1: SUPERVISOR ────────────────────────────────────────────────
    _status("supervisor", "running", agent="supervisor")
    print("\n=== SUPERVISOR AGENT ===")

    tasks = [
        f"{question} - Current trends and overview",
        f"{question} - Key players and market leaders",
        f"{question} - Challenges and barriers",
        f"{question} - Future outlook and opportunities",
    ]

    plan = {
        "topic": question,
        "tasks": tasks,
        "research_questions": [
            f"What are the dominant trends in {question}?",
            f"Who are the key actors in {question}?",
            f"What challenges does {question} face?",
            f"What is the future trajectory of {question}?",
        ]
    }

    # Save supervisor plan
    run_dir = Path(os.environ.get("AETHER_RUN_DIR", ".")).resolve()
    try:
        (run_dir / "supervisor_plan.json").write_text(
            json.dumps(plan, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except OSError:
        pass

    print("Research plan created:")
    for task in tasks:
        print(f"  · {task}")

    _status("supervisor", "completed", agent="supervisor", tasks=len(tasks))

    # ── STAGE 2: RESEARCH AGENT ────────────────────────────────────────────
    _status("research", "running", agent="research", source_count=0)
    print("\n=== RESEARCH AGENT ===")

    research_results = []

    try:
        client = TavilyClient(api_key=api_key)

        for task in tasks:
            print(f"\nSearching: {task}")

            for attempt in range(1, 4):
                try:
                    response = client.search(query=task, max_results=3)
                    results = response.get("results", [])

                    for result in results:
                        result["task"] = task
                        research_results.append(result)

                    print(f"  Found {len(results)} results.")
                    logging.info("Search succeeded: %s", task)
                    break

                except Exception as error:
                    print(f"  Attempt {attempt} failed: {error}")
                    logging.exception("Search attempt failed")
                    if attempt < 3:
                        time.sleep(2)

            # Update source count after each task
            _status("research", "running", agent="research",
                    source_count=len(research_results))

    except Exception:
        logging.exception("Research agent failed")
        _status("research", "failed", "Research agent encountered an error.",
                agent="research")
        print("Research agent failed. Check research_agent.log.")
        return

    if not research_results:
        _status("research", "failed",
                "No research results were collected. Try a different topic.",
                agent="research")
        print("\nNo research results were collected.")
        return

    # Save raw results
    try:
        (run_dir / "results.json").write_text(
            json.dumps(research_results, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
    except OSError:
        pass

    _status("research", "completed", agent="research",
            source_count=len(research_results))

    print(f"\n=== RESEARCH FINDINGS ({len(research_results)} sources) ===")
    for i, result in enumerate(research_results, start=1):
        print(f"\n{i}. {result.get('title', 'No title')}")
        print(f"   URL: {result.get('url', '')}")

    # ── STAGE 3: DATA ANALYSIS ─────────────────────────────────────────────
    _status("analysis", "running", agent="analysis",
            source_count=len(research_results))
    print("\n=== DATA ANALYSIS AGENT ===")

    analysis_result = {}
    try:
        analysis_result = analyze_research(research_results)
        logging.info("Data analysis complete")
    except Exception:
        logging.exception("Data analysis failed")
        print("Data analysis failed. Check research_agent.log.")

    _status("analysis", "completed", agent="analysis",
            source_count=len(research_results),
            themes=len(analysis_result.get("themes", [])))

    # ── STAGE 4: FACT-CHECKING ─────────────────────────────────────────────
    _status("fact_check", "running", agent="fact_check",
            source_count=len(research_results))
    print("\n=== FACT-CHECKING AGENT ===")

    fact_check_report = {"claims": [], "evidence_sources": []}

    try:
        result = fact_check_research(research_results)
        if isinstance(result, dict):
            fact_check_report = result

        claims = fact_check_report.get("claims", [])
        if not isinstance(claims, list):
            claims = []

        total_claims = len(claims)
        corroborated = sum(
            1 for c in claims
            if isinstance(c, dict) and
            c.get("independent_status") == "CORROBORATED BY DISTINCT DOMAINS"
        )

        print(f"\nTotal claims reviewed: {total_claims}")
        print(f"Corroborated by distinct domains: {corroborated}")

        # Save fact_check_report.json
        try:
            (run_dir / "fact_check_report.json").write_text(
                json.dumps(fact_check_report, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )
        except OSError:
            pass

        # Also generate research_quality_report.txt (for existing download route)
        _write_quality_report(run_dir, question, claims)

        logging.info("Fact-checking complete: %d claims", total_claims)

    except Exception:
        logging.exception("Fact-checking failed")
        print("Fact-checking failed. Check research_agent.log.")

    _status("fact_check", "completed", agent="fact_check",
            source_count=len(research_results),
            claims=len(fact_check_report.get("claims", [])))

    # ── STAGE 5: WRITER ────────────────────────────────────────────────────
    _status("writer", "running", agent="writer",
            source_count=len(research_results))
    print("\n=== AI WRITER AGENT ===")

    try:
        write_report(question, research_results, fact_check_report)
        logging.info("Writer agent finished")
    except Exception:
        logging.exception("Report generation failed")
        _status("writer", "failed", "Report generation failed.", agent="writer")
        print("Report generation failed. Check research_agent.log.")
        return

    _status("completed", "completed", agent="writer",
            source_count=len(research_results))
    print("\n=== AETHER RESEARCH PIPELINE COMPLETED ===")


def _write_quality_report(run_dir: Path, question: str, claims: list) -> None:
    """Write the text quality report (preserves existing download route)."""
    total = len(claims)
    single = sum(1 for c in claims if isinstance(c, dict) and
                 c.get("status") == "SINGLE-SOURCE EVIDENCE")
    multi = sum(1 for c in claims if isinstance(c, dict) and
                c.get("status") == "SUPPORTED BY MULTIPLE SNIPPETS")
    insufficient = sum(1 for c in claims if isinstance(c, dict) and
                       c.get("status") == "INSUFFICIENT EVIDENCE")
    corroborated = sum(1 for c in claims if isinstance(c, dict) and
                       c.get("independent_status") == "CORROBORATED BY DISTINCT DOMAINS")

    coverage = round((single + multi) / total * 100) if total else 0
    checked = sum(1 for c in claims if isinstance(c, dict) and
                  c.get("independent_status") not in ("NOT CHECKED", None))
    corr_rate = round(corroborated / checked * 100) if checked else 0

    lines = [
        "RESEARCH QUALITY DASHBOARD",
        "==========================\n",
        f"Research topic: {question}\n",
        "ORIGINAL EVIDENCE",
        "-----------------",
        f"Total claims reviewed: {total}",
        f"Claims with matching quotes: {single + multi}/{total}",
        f"Original evidence coverage: {coverage}%",
        f"Single-source claims: {single}",
        f"Multiple-snippet claims: {multi}",
        f"Claims with insufficient evidence: {insufficient}\n",
        "INDEPENDENT VERIFICATION",
        "------------------------",
        f"Claims checked against new domains: {checked}",
        f"Corroborated by distinct domains: {corroborated}",
        f"Corroboration rate among checked claims: {corr_rate}%\n",
        "CLAIM-BY-CLAIM RESULTS",
        "----------------------",
    ]

    for i, claim in enumerate(claims, 1):
        if not isinstance(claim, dict):
            continue
        lines += [
            f"\n{i}. {claim.get('claim', 'Unknown claim')}",
            f"   Original evidence: {claim.get('status', 'UNKNOWN')}",
            f"   Independent verification: {claim.get('independent_status', 'NOT CHECKED')}",
        ]

    lines += [
        "\nLIMITATIONS",
        "-----------",
        "1. Quote matching does not prove factual accuracy.",
        "2. AI assessments can make mistakes.",
        "3. Different domains may repeat the same original report.",
        "4. Source reliability and dates need human review.",
    ]

    try:
        (run_dir / "research_quality_report.txt").write_text(
            "\n".join(lines), encoding="utf-8"
        )
    except OSError as exc:
        logging.warning("Could not write research_quality_report.txt: %s", exc)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nResearch cancelled by user.")
    except Exception:
        logging.exception("Unexpected pipeline error")
        print("\nAn unexpected error occurred. Check research_agent.log.")