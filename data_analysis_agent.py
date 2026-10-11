
from collections import Counter


def analyze_research(results):
    if len(results) == 0:
        print("No research results to analyze.")
        return

    # Count results in each research area
    task_counts = Counter(
        result["task"] for result in results
    )

    print("\n=== DATA ANALYSIS AGENT ===")

    for task, count in task_counts.items():
        print(task, ":", count, "results")

    # Count unique websites
    websites = set()

    for result in results:
        url = result.get("url", "")

        if url:
            websites.add(url.split("/")[2])

    print("Total results:", len(results))
    print("Unique websites:", len(websites))
