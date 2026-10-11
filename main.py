import os
import time
import logging
from dotenv import load_dotenv
from tavily import TavilyClient

from data_analysis_agent import analyze_research
from fact_checking_agent import fact_check_research
from writer_agent import write_report


def main():
    load_dotenv()

    logging.basicConfig(
        filename="research_agent.log",
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        encoding="utf-8"
    )

    print("=== AUTONOMOUS AI RESEARCH AGENT ===")

    question = input("\nWhat do you want to research? ").strip()

    if not question:
        print("Please enter a research topic.")
        return

    api_key = os.getenv("TAVILY_API_KEY")

    if not api_key:
        print("TAVILY_API_KEY not found. Check your .env file.")
        return

    print("\n=== SUPERVISOR AGENT ===")

    tasks = [
        f"{question} - Current market trends",
        f"{question} - Major companies and competitors",
        f"{question} - Market challenges",
        f"{question} - Future opportunities"
    ]

    for task in tasks:
        print(task)

    research_results = []

    print("\n=== RESEARCH AGENT ===")

    try:
        client = TavilyClient(api_key=api_key)

        for task in tasks:
            print(f"\nSearching: {task}")

            for attempt in range(1, 4):
                try:
                    response = client.search(
                        query=task,
                        max_results=3
                    )

                    results = response.get("results", [])

                    for result in results:
                        result["task"] = task
                        research_results.append(result)

                    print(
                        f"Search successful! Found {len(results)} results."
                    )
                    logging.info("Search succeeded for task: %s", task)
                    break

                except Exception as error:
                    print(
                        f"Search attempt {attempt} failed: {error}"
                    )
                    logging.exception("Search attempt failed")

                    if attempt < 3:
                        time.sleep(2)

    except Exception:
        logging.exception("Research agent failed")
        print("Research agent failed. Check research_agent.log.")
        return

    if not research_results:
        print("\nNo research results were collected.")
        return

    print("\n=== RESEARCH FINDINGS ===")

    for i, result in enumerate(research_results, start=1):
        print(f"\n{i}. Research area: {result.get('task', 'Unknown')}")
        print(f"Title: {result.get('title', 'No title')}")
        print(f"URL: {result.get('url', '')}")
        print(f"Information: {result.get('content', '')[:500]}")

    print("\n=== DATA ANALYSIS AGENT ===")

    try:
        analyze_research(research_results)
    except Exception:
        logging.exception("Data analysis failed")
        print("Data analysis failed. Check research_agent.log.")

    print("\n=== FACT-CHECKING AGENT ===")

    fact_check_report = {
        "claims": [],
        "evidence_sources": []
    }

    try:
        result = fact_check_research(research_results)

        if isinstance(result, dict):
            fact_check_report = result

        claims = fact_check_report.get("claims", [])

        if not isinstance(claims, list):
            claims = []

        total_claims = len(claims)
        single_source_claims = 0
        multiple_snippet_claims = 0
        insufficient_claims = 0
        unknown_status_claims = 0

        corroborated_claims = 0
        no_independent_support_claims = 0
        no_new_domain_claims = 0
        verification_failed_claims = 0
        skipped_claims = 0
        not_checked_claims = 0

        for claim in claims:
            if not isinstance(claim, dict):
                unknown_status_claims += 1
                continue

            original_status = claim.get("status", "UNKNOWN")

            if original_status == "SINGLE-SOURCE EVIDENCE":
                single_source_claims += 1
            elif original_status == "SUPPORTED BY MULTIPLE SNIPPETS":
                multiple_snippet_claims += 1
            elif original_status == "INSUFFICIENT EVIDENCE":
                insufficient_claims += 1
            else:
                unknown_status_claims += 1

            independent_status = claim.get(
                "independent_status", "NOT CHECKED"
            )

            if independent_status == "CORROBORATED BY DISTINCT DOMAINS":
                corroborated_claims += 1
            elif independent_status == "NO SUPPORTING INDEPENDENT EVIDENCE":
                no_independent_support_claims += 1
            elif independent_status == "NO NEW DOMAINS FOUND":
                no_new_domain_claims += 1
            elif independent_status in (
                "VERIFICATION FAILED",
                "SEARCH FAILED"
            ):
                verification_failed_claims += 1
            elif independent_status.startswith("SKIPPED"):
                skipped_claims += 1
            else:
                not_checked_claims += 1

        claims_with_matching_evidence = (
            single_source_claims + multiple_snippet_claims
        )

        if total_claims:
            original_evidence_coverage = round(
                claims_with_matching_evidence / total_claims * 100
            )
        else:
            original_evidence_coverage = 0

        independent_checked = (
            corroborated_claims
            + no_independent_support_claims
            + no_new_domain_claims
            + verification_failed_claims
        )

        if independent_checked:
            independent_corroboration_rate = round(
                corroborated_claims / independent_checked * 100
            )
        else:
            independent_corroboration_rate = 0

        print("\n=== ORIGINAL EVIDENCE DASHBOARD ===")
        print(f"Total claims reviewed: {total_claims}")
        print(
            f"Claims with matching quotes: "
            f"{claims_with_matching_evidence}/{total_claims}"
        )
        print(
            f"Original evidence coverage: "
            f"{original_evidence_coverage}%"
        )
        print(f"Single-source claims: {single_source_claims}")
        print(f"Multiple-snippet claims: {multiple_snippet_claims}")
        print(f"Claims with insufficient evidence: {insufficient_claims}")

        print("\n=== INDEPENDENT VERIFICATION DASHBOARD ===")
        print(f"Claims reviewed: {total_claims}")
        print(f"Claims checked against new domains: {independent_checked}")
        print(f"Corroborated by distinct domains: {corroborated_claims}")
        print(
            f"Corroboration rate among checked claims: "
            f"{independent_corroboration_rate}%"
        )
        print(
            f"No supporting independent evidence: "
            f"{no_independent_support_claims}"
        )
        print(f"No new domains found: {no_new_domain_claims}")
        print(f"Verification failures: {verification_failed_claims}")
        print(f"Skipped claims: {skipped_claims}")
        print(f"Not checked / unknown status: {not_checked_claims}")

        print("\nIMPORTANT:")
        print("- Matching quotes do not prove factual accuracy.")
        print("- Different domains do not guarantee independent reporting.")
        print("- Corroboration means candidate evidence passed automated checks.")
        print("- Important claims still need human review.")

        with open(
            "research_quality_report.txt",
            "w",
            encoding="utf-8"
        ) as file:
            file.write("RESEARCH QUALITY DASHBOARD\n")
            file.write("==========================\n\n")
            file.write(f"Research topic: {question}\n\n")

            file.write("ORIGINAL EVIDENCE\n")
            file.write("-----------------\n")
            file.write(f"Total claims reviewed: {total_claims}\n")
            file.write(
                f"Claims with matching quotes: "
                f"{claims_with_matching_evidence}/{total_claims}\n"
            )
            file.write(
                f"Original evidence coverage: "
                f"{original_evidence_coverage}%\n"
            )
            file.write(f"Single-source claims: {single_source_claims}\n")
            file.write(
                f"Multiple-snippet claims: {multiple_snippet_claims}\n"
            )
            file.write(
                f"Claims with insufficient evidence: "
                f"{insufficient_claims}\n"
            )

            file.write("\nINDEPENDENT VERIFICATION\n")
            file.write("------------------------\n")
            file.write(
                f"Claims checked against new domains: "
                f"{independent_checked}\n"
            )
            file.write(
                f"Corroborated by distinct domains: "
                f"{corroborated_claims}\n"
            )
            file.write(
                f"Corroboration rate among checked claims: "
                f"{independent_corroboration_rate}%\n"
            )
            file.write(
                f"No supporting independent evidence: "
                f"{no_independent_support_claims}\n"
            )
            file.write(f"No new domains found: {no_new_domain_claims}\n")
            file.write(f"Verification failures: {verification_failed_claims}\n")
            file.write(f"Skipped claims: {skipped_claims}\n")
            file.write(f"Not checked / unknown status: {not_checked_claims}\n")

            file.write("\nCLAIM-BY-CLAIM RESULTS\n")
            file.write("----------------------\n")

            for i, claim in enumerate(claims, start=1):
                if not isinstance(claim, dict):
                    continue

                file.write(f"\n{i}. {claim.get('claim', 'Unknown claim')}\n")
                file.write(
                    f"Original evidence: {claim.get('status', 'UNKNOWN')}\n"
                )
                file.write(
                    "Independent verification: "
                    f"{claim.get('independent_status', 'NOT CHECKED')}\n"
                )
                file.write(
                    f"Independent domains: "
                    f"{', '.join(claim.get('independent_domains', [])) or 'None'}\n"
                )

            file.write("\nLIMITATIONS\n")
            file.write("-----------\n")
            file.write(
                "1. Quote matching does not prove factual accuracy.\n"
                "2. AI support assessments can make mistakes.\n"
                "3. Different domains may repeat the same original report.\n"
                "4. Source reliability, publication dates, and context need review.\n"
                "5. A failed or skipped check is not evidence that a claim is false.\n"
            )

        print("\nDashboard saved to: research_quality_report.txt")
        logging.info("Research quality dashboard completed")

    except Exception:
        logging.exception("Fact-checking dashboard failed")
        print("Fact-checking dashboard failed. Check research_agent.log.")

    print("\n=== AI WRITER AGENT ===")

    try:
        write_report(
            question,
            research_results,
            fact_check_report
        )
        logging.info("Writer agent finished")

    except Exception:
        logging.exception("Report generation failed")
        print("Report generation failed. Check research_agent.log.")

    print("\n=== RESEARCH PIPELINE COMPLETED ===")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nResearch cancelled by user.")
    except Exception:
        logging.exception("Unexpected pipeline error")
        print("\nAn unexpected error occurred.")
        print("Check research_agent.log.")