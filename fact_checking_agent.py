
import os
import json
import logging
import re
import time
from urllib.parse import urlparse

from dotenv import load_dotenv
from groq import Groq
from tavily import TavilyClient


# ---------------- CONFIGURATION ----------------

MODEL_NAME = "openai/gpt-oss-120b"

# Fewer claims means fewer Groq requests and fewer rate-limit errors.
MAX_CLAIMS_TO_VERIFY = 5
MAX_INDEPENDENT_RESULTS = 3
MAX_RETRIES = 3

load_dotenv()

logging.basicConfig(
    filename="research_agent.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


# ---------------- HELPER FUNCTIONS ----------------

def get_domain(url):
    """Return the domain name of a URL."""
    try:
        domain = urlparse(url).netloc.lower()
        return domain.removeprefix("www.")
    except Exception:
        return ""


def parse_json_response(response_text):
    """Extract a JSON object from an AI response."""
    if not response_text:
        raise ValueError("The AI returned an empty response.")

    text = response_text.strip()

    # Remove Markdown code fences if present.
    text = re.sub(r"^\s*```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text)

    # First try parsing the complete response.
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # If the AI added extra text, find a valid JSON object.
    decoder = json.JSONDecoder()

    for position, character in enumerate(text):
        if character == "{":
            try:
                data, _ = decoder.raw_decode(text[position:])
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                continue

    raise ValueError(
        "No valid JSON object found. Response begins: "
        + text[:300]
    )


def call_groq_with_retry(groq_client, messages, max_tokens=2000):
    """Retry temporary Groq rate limits with a short delay."""
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            response = groq_client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=0,
                max_completion_tokens=max_tokens
            )

            if not response.choices:
                raise ValueError("Groq returned no response choices.")

            if response.choices[0].finish_reason == "length":
                raise ValueError(
                    "The AI response was cut off because it reached "
                    "the token limit."
                )

            content = response.choices[0].message.content or ""
            return parse_json_response(content)

        except Exception as error:
            last_error = error
            error_text = str(error).lower()

            is_rate_limit = (
                "429" in error_text
                or "rate_limit" in error_text
                or "rate limit" in error_text
            )

            if is_rate_limit and attempt < MAX_RETRIES - 1:
                wait_seconds = 15 * (attempt + 1)

                print(
                    f"Groq rate limit reached. "
                    f"Retrying in {wait_seconds} seconds..."
                )
                time.sleep(wait_seconds)
                continue

            raise last_error

    raise last_error


def get_evidence_text(result):
    """Get the available text from a research result."""
    return (
        result.get("content")
        or result.get("raw_content")
        or result.get("snippet")
        or ""
    )


def contains_claim_numbers(claim, quote):
    """
    Avoid confirming a numerical claim with evidence containing
    conflicting numbers.

    This is a conservative check, not a complete fact-check.
    """
    claim_numbers = re.findall(r"\d+(?:\.\d+)?", claim)
    quote_numbers = re.findall(r"\d+(?:\.\d+)?", quote)

    # If the claim has numbers, require the same numeric values
    # to appear in the evidence quote.
    for number in claim_numbers:
        if number not in quote_numbers:
            return False

    return True


# ---------------- ORIGINAL EVIDENCE REVIEW ----------------

def validate_claims(claims, evidence):
    """Check whether each claim has a matching quote in the research."""
    validated_claims = []

    for claim_item in claims:
        if not isinstance(claim_item, dict):
            continue

        claim_text = str(
            claim_item.get("claim")
            or claim_item.get("statement")
            or ""
        ).strip()

        if not claim_text:
            continue

        quote = str(
            claim_item.get("quote")
            or claim_item.get("evidence_quote")
            or ""
        ).strip()

        source_number = claim_item.get(
            "source_number",
            claim_item.get("source", claim_item.get("source_id"))
        )

        matched_source = None

        # Try the supplied source number first.
        if source_number is not None:
            try:
                index = int(source_number) - 1
                if 0 <= index < len(evidence):
                    matched_source = evidence[index]
            except (ValueError, TypeError):
                pass

        # Otherwise, look for the quote in all sources.
        if matched_source is None and quote:
            for source in evidence:
                if quote in get_evidence_text(source):
                    matched_source = source
                    break

        quote_matches = False

        if matched_source is not None and quote:
            source_text = get_evidence_text(matched_source)
            quote_matches = quote in source_text

        # A matching quote is evidence of what the source says,
        # not proof that the statement is true.
        if quote_matches:
            status = "SINGLE-SOURCE EVIDENCE"
            source_title = matched_source.get("title", "Unknown source")
            source_url = matched_source.get("url", "")
        else:
            status = "INSUFFICIENT EVIDENCE"
            source_title = ""
            source_url = ""

        validated_claims.append({
            "claim": claim_text,
            "quote": quote if quote_matches else "",
            "source_number": source_number,
            "status": status,
            "source_title": source_title,
            "source_url": source_url,
            "independent_status": "NOT CHECKED",
            "independent_evidence": [],
            "independent_domains": []
        })

    return validated_claims


# ---------------- INDEPENDENT SOURCE VERIFICATION ----------------

def verify_independent_source(claim, original_quotes, tavily, groq_client):
    """
    Search for new sources and ask the AI whether their evidence
    supports the complete claim.
    """
    try:
        search_response = tavily.search(
            query=f"{claim} evidence data report",
            max_results=MAX_INDEPENDENT_RESULTS,
            search_depth="basic"
        )

        candidates = search_response.get("results", [])
        original_domains = {
            get_domain(url)
            for url in original_quotes.get("original_urls", [])
            if url
        }

        # Exclude original domains and duplicate domains.
        unique_candidates = []
        seen_domains = set()

        for candidate in candidates:
            url = candidate.get("url", "")
            domain = get_domain(url)

            if not domain:
                continue

            if domain in original_domains or domain in seen_domains:
                continue

            seen_domains.add(domain)

            snippet = (
                candidate.get("content")
                or candidate.get("snippet")
                or ""
            ).strip()

            if snippet:
                unique_candidates.append({
                    "title": candidate.get("title", "Untitled source"),
                    "url": url,
                    "domain": domain,
                    "quote": snippet[:1800]
                })

        if not unique_candidates:
            return {
                "independent_status": "NO NEW DOMAINS FOUND",
                "independent_evidence": [],
                "independent_domains": [],
                "explanation": "The search did not find usable sources "
                               "from new domains."
            }

        candidates_json = json.dumps(
            unique_candidates,
            ensure_ascii=False
        )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a strict evidence reviewer. "
                    "Do not assume a claim is true. "
                    "A source supports a claim only when its supplied text "
                    "supports the claim's specific meaning and details. "
                    "For numerical claims, check the exact figures, units, "
                    "time period, and direction. Different figures do not "
                    "corroborate the same numerical claim. "
                    "A source listing a company does not prove that it is "
                    "a market leader or a star player. "
                    "Do not use outside knowledge. "
                    "Return one valid JSON object only."
                )
            },
            {
                "role": "user",
                "content": f"""
Evaluate whether any candidate source directly supports this claim.

CLAIM:
{claim}

CANDIDATE SOURCES:
{candidates_json}

Return this JSON structure:
{{
  "evaluations": [
    {{
      "url": "exact candidate URL",
      "supports_claim": true,
      "supporting_quote": "exact substring copied from that source",
      "reason": "brief explanation"
    }}
  ]
}}

Rules:
- Include one evaluation for every candidate source.
- supports_claim must be true only when the text directly supports
  the full claim, not merely the general topic.
- The supporting_quote must be an exact substring from that candidate's
  supplied quote.
- If a number, unit, year, or other important detail conflicts,
  supports_claim must be false.
- If evidence is insufficient, set supports_claim to false.
- Do not invent quotations or URLs.
"""
            }
        ]

        ai_data = call_groq_with_retry(
            groq_client,
            messages,
            max_tokens=1600
        )

        evaluations = ai_data.get("evaluations", [])

        if not isinstance(evaluations, list):
            evaluations = []

        approved_evidence = []

        candidate_by_url = {
            item["url"]: item for item in unique_candidates
        }

        for evaluation in evaluations:
            if not isinstance(evaluation, dict):
                continue

            url = evaluation.get("url", "")
            candidate = candidate_by_url.get(url)

            if not candidate:
                continue

            if evaluation.get("supports_claim") is not True:
                continue

            quote = str(
                evaluation.get("supporting_quote") or ""
            ).strip()

            # The quote must really exist in the candidate snippet.
            if not quote or quote not in candidate["quote"]:
                continue

            # Reject numerical mismatches such as $15.9B vs $60B.
            if not contains_claim_numbers(claim, quote):
                continue

            approved_evidence.append({
                "title": candidate["title"],
                "url": candidate["url"],
                "domain": candidate["domain"],
                "quote": quote,
                "reason": str(evaluation.get("reason", ""))
            })

        approved_domains = sorted({
            item["domain"] for item in approved_evidence
        })

        if approved_evidence:
            status = "CORROBORATED BY DISTINCT DOMAINS"
            explanation = (
                "At least one new-domain source passed the claim-support "
                "assessment and exact-quote validation. This does not "
                "prove the source is editorially independent."
            )
        else:
            status = "NO SUPPORTING INDEPENDENT EVIDENCE"
            explanation = (
                "No candidate passed the direct-support, exact-quote, "
                "and numerical consistency checks."
            )

        return {
            "independent_status": status,
            "independent_evidence": approved_evidence,
            "independent_domains": approved_domains,
            "explanation": explanation
        }

    except Exception as error:
        logging.exception("Independent verification failed.")

        return {
            "independent_status": "VERIFICATION FAILED",
            "independent_evidence": [],
            "independent_domains": [],
            "explanation": str(error)
        }


# ---------------- MAIN FACT-CHECKING AGENT ----------------

def fact_check_research(results):
    """Extract claims, review their original evidence, and verify them."""
    print("\n=== AI FACT-CHECKING AGENT ===")
    print("Checking original quotes and searching for independent evidence...")

    groq_api_key = os.getenv("GROQ_API_KEY")
    tavily_api_key = os.getenv("TAVILY_API_KEY")

    if not groq_api_key or not tavily_api_key:
        message = (
            "Missing GROQ_API_KEY or TAVILY_API_KEY in your .env file."
        )
        print(message)
        logging.error(message)

        return {
            "note": message,
            "claims": [],
            "evidence_sources": results,
            "error": message
        }

    groq_client = Groq(api_key=groq_api_key)
    tavily = TavilyClient(api_key=tavily_api_key)

    research_evidence = []

    for index, result in enumerate(results, start=1):
        research_evidence.append({
            "source_number": index,
            "title": result.get("title", "Untitled source"),
            "url": result.get("url", ""),
            "content": get_evidence_text(result)
        })

    evidence_text = json.dumps(
        research_evidence,
        ensure_ascii=False
    )

    extraction_messages = [
        {
            "role": "system",
            "content": (
                "You are a cautious research fact-checker. "
                "Extract up to 5 important factual claims explicitly "
                "supported by the supplied research snippets. "
                "Do not invent facts. Preserve numerical values, units, "
                "and dates exactly. Every quote must be copied verbatim "
                "from the selected source. Return valid JSON only."
            )
        },
        {
            "role": "user",
            "content": f"""
Review these research sources:

{evidence_text}

Return exactly this JSON structure:
{{
  "claims": [
    {{
      "claim": "one factual claim",
      "source_number": 1,
      "quote": "exact quote copied from that source"
    }}
  ]
}}

Rules:
- Extract at most {MAX_CLAIMS_TO_VERIFY} claims.
- source_number must match the source_number in the supplied evidence.
- quote must be an exact substring of that source's content.
- Prefer specific, important claims over vague opinions.
- Do not combine facts from different sources into one claim.
- Return an empty claims array if no claims can be extracted.
"""
        }
    ]

    try:
        ai_data = call_groq_with_retry(
            groq_client,
            extraction_messages,
            max_tokens=2500
        )

        extracted_claims = ai_data.get("claims", [])

        if not isinstance(extracted_claims, list):
            raise ValueError("The AI response does not contain a claims list.")

        extracted_claims = extracted_claims[:MAX_CLAIMS_TO_VERIFY]
        validated_claims = validate_claims(
            extracted_claims,
            research_evidence
        )

    except Exception as error:
        message = f"Could not extract claims: {error}"
        print(message)
        logging.exception(message)

        return {
            "note": message,
            "claims": [],
            "evidence_sources": results,
            "error": str(error)
        }

    print("\n=== ORIGINAL EVIDENCE REVIEW ===")

    for index, item in enumerate(validated_claims, start=1):
        print(f"\nClaim {index}: {item['claim']}")
        print(f"Original evidence status: {item['status']}")

        if item["quote"]:
            print(f"Source: {item['source_title']}")
            print(f"URL: {item['source_url']}")
            print(f"Quote: {item['quote']}")
        else:
            print("No exact matching quote was found.")

    print("\n=== INDEPENDENT SOURCE VERIFICATION ===")

    for index, item in enumerate(validated_claims, start=1):
        if item["status"] == "INSUFFICIENT EVIDENCE":
            item["independent_status"] = "SKIPPED - INSUFFICIENT EVIDENCE"
            item["independent_evidence"] = []
            item["independent_domains"] = []
            continue

        print(f"\nChecking claim {index}: {item['claim']}")

        original_quotes = {
            "original_urls": [item["source_url"]]
        }

        verification = verify_independent_source(
            item["claim"],
            original_quotes,
            tavily,
            groq_client
        )

        item["independent_status"] = verification["independent_status"]
        item["independent_evidence"] = verification["independent_evidence"]
        item["independent_domains"] = verification["independent_domains"]
        item["independent_explanation"] = verification.get(
            "explanation", ""
        )

        print(f"Independent status: {item['independent_status']}")
        print(f"Explanation: {item['independent_explanation']}")

        for source in item["independent_evidence"]:
            print(f"  New domain: {source['domain']}")
            print(f"  Title: {source['title']}")
            print(f"  URL: {source['url']}")
            print(f"  Quote: {source['quote']}")

        # Avoid immediately sending another large request to Groq.
        time.sleep(2)

    report_data = {
        "note": (
            "A matching quote shows what a source says, not whether "
            "the claim is true. Automated corroboration is not proof "
            "of truth or editorial independence."
        ),
        "claims": validated_claims,
        "evidence_sources": results
    }

    try:
        with open(
            "fact_check_report.txt",
            "w",
            encoding="utf-8"
        ) as file:
            file.write("FACT-CHECKING REPORT\n")
            file.write("=" * 60 + "\n\n")

            file.write(report_data["note"] + "\n\n")

            for index, item in enumerate(validated_claims, start=1):
                file.write(f"Claim {index}: {item['claim']}\n")
                file.write(
                    f"Original evidence: {item['status']}\n"
                )
                file.write(
                    f"Independent verification: "
                    f"{item['independent_status']}\n"
                )

                if item.get("quote"):
                    file.write(f"Original quote: {item['quote']}\n")

                file.write(
                    "Independent domains: "
                    + ", ".join(item["independent_domains"])
                    + "\n"
                )

                for source in item["independent_evidence"]:
                    file.write(f"  Source: {source['title']}\n")
                    file.write(f"  URL: {source['url']}\n")
                    file.write(f"  Quote: {source['quote']}\n")

                file.write("\n")

        print("\nFact-check report saved to: fact_check_report.txt")

    except OSError as error:
        logging.exception("Could not save fact-check report.")
        print(f"Could not save fact-check report: {error}")

    print(
        "\nRemember: matching quotes and different domains "
        "do not guarantee factual truth."
    )

    return report_data
