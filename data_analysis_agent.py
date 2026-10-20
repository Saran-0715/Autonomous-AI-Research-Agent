
import json
import logging
import os
import re
import time
from collections import Counter

from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = "openai/gpt-oss-120b"


def _call_groq(client, messages, max_tokens=2000):
    """Call Groq with exponential backoff on rate-limit errors."""
    for attempt in range(1, 4):
        try:
            resp = client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.3,
            )
            return resp.choices[0].message.content
        except Exception as exc:
            err = str(exc).lower()
            if "rate_limit" in err and attempt < 3:
                wait = 20 * attempt
                logging.warning("Groq rate limit hit – waiting %ss", wait)
                time.sleep(wait)
                continue
            logging.exception("Groq call failed on attempt %d", attempt)
            if attempt == 3:
                raise


def _parse_json(text: str) -> dict:
    """Extract a JSON object from an LLM response."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch == "{":
            try:
                data, _ = decoder.raw_decode(text[i:])
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                continue

    raise ValueError("No valid JSON object found in LLM response.")


def analyze_research(results: list) -> dict:
    """
    Analyze research results using Groq.

    Returns a dict with keys: themes, comparisons, insights, source_summary.
    Also writes analysis.json to the current working directory.
    """
    print("\n=== DATA ANALYSIS AGENT ===")

    if not results:
        print("No research results to analyze.")
        return {}

    # --- Basic statistics (no API needed) ---
    task_counts = Counter(r.get("task", "Unknown") for r in results)
    websites = {r.get("url", "").split("/")[2] for r in results if r.get("url")}

    print(f"Total results: {len(results)}")
    print(f"Unique websites: {len(websites)}")
    for task, count in task_counts.items():
        print(f"  {task}: {count} results")

    # --- Groq-powered qualitative analysis ---
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logging.warning("GROQ_API_KEY not set; skipping qualitative analysis.")
        basic = {
            "themes": [t for t in task_counts],
            "comparisons": [],
            "insights": ["Basic statistical analysis only — GROQ_API_KEY not configured."],
            "source_summary": {
                "total_results": len(results),
                "unique_websites": len(websites),
                "tasks_covered": dict(task_counts),
            },
        }
        _save_analysis(basic)
        return basic

    try:
        from groq import Groq

        client = Groq(api_key=api_key)

        # Build condensed source list for the prompt
        source_lines = []
        for i, r in enumerate(results[:20], 1):  # cap to avoid token overflow
            title = r.get("title", "Untitled")
            task = r.get("task", "Unknown")
            snippet = str(r.get("content", ""))[:600]
            source_lines.append(f"[Source {i}] Task: {task}\nTitle: {title}\nSnippet: {snippet}")

        source_block = "\n\n".join(source_lines)

        prompt = f"""You are a senior research analyst. Analyze the following research results and return ONLY a valid JSON object — no prose before or after.

Research results:
{source_block}

Return this exact JSON structure:
{{
  "themes": ["<recurring theme 1>", "<theme 2>", ...],
  "comparisons": ["<meaningful comparison or contrast observed>", ...],
  "insights": ["<evidence-backed insight>", "<insight 2>", ...],
  "source_summary": {{
    "total_results": {len(results)},
    "unique_websites": {len(websites)},
    "tasks_covered": {json.dumps(dict(task_counts))}
  }}
}}

Rules:
- Only include insights supported by the provided snippets.
- Do not invent statistics or URLs.
- List 3–6 themes, 2–4 comparisons, 3–5 insights.
"""

        response = _call_groq(client, [{"role": "user", "content": prompt}], max_tokens=1500)
        analysis = _parse_json(response)

        # Ensure source_summary is always present
        analysis.setdefault("source_summary", {
            "total_results": len(results),
            "unique_websites": len(websites),
            "tasks_covered": dict(task_counts),
        })

        print("\nKey themes identified:")
        for theme in analysis.get("themes", []):
            print(f"  - {theme}")
        print("\nKey insights:")
        for insight in analysis.get("insights", []):
            print(f"  - {insight}")

        _save_analysis(analysis)
        logging.info("Data analysis complete: %d themes, %d insights",
                     len(analysis.get("themes", [])),
                     len(analysis.get("insights", [])))
        return analysis

    except Exception:
        logging.exception("Groq-based analysis failed; returning basic stats.")
        basic = {
            "themes": list(task_counts.keys()),
            "comparisons": [],
            "insights": ["Qualitative analysis unavailable due to an API error."],
            "source_summary": {
                "total_results": len(results),
                "unique_websites": len(websites),
                "tasks_covered": dict(task_counts),
            },
        }
        _save_analysis(basic)
        return basic


def _save_analysis(analysis: dict) -> None:
    """Persist analysis to analysis.json in the current directory."""
    try:
        with open("analysis.json", "w", encoding="utf-8") as f:
            json.dump(analysis, f, indent=2, ensure_ascii=False)
        print("\nAnalysis saved to: analysis.json")
    except OSError as exc:
        logging.warning("Could not save analysis.json: %s", exc)
