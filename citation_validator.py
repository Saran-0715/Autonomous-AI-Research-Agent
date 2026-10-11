
import re
from pathlib import Path


def validate_citations():
    report_path = Path("research_report.txt")
    output_path = Path("citation_quality_report.txt")

    if not report_path.exists():
        print("Error: research_report.txt not found.")
        return

    report = report_path.read_text(encoding="utf-8")

    # Find headings like "## 8. Sources" or "## References"
    match = re.search(
        r"(?im)^#{1,3}\s*(?:\d+\.\s*)?(?:sources|references)\s*$",
        report
    )

    if not match:
        print("Error: Sources or References heading not found.")
        return

    main_text = report[:match.start()]
    source_text = report[match.end():]

    # Extract numbered source entries like "### Source 1: Title"
    source_numbers = {
        int(number)
        for number in re.findall(
            r"(?im)^#{1,4}\s*Source\s+(\d+)\s*:",
            source_text
        )
    }

    # Find citations like [Source 1] and [Source 1, 3, 4]
    citation_pattern = r"\[\s*Sources?\s+([\d\s,]+)\s*\]"

    citations = re.findall(citation_pattern, main_text)
    used_numbers = set()
    invalid_numbers = set()

    for citation in citations:
        numbers = [
            int(number)
            for number in re.findall(r"\d+", citation)
        ]

        for number in numbers:
            used_numbers.add(number)

            if number not in source_numbers:
                invalid_numbers.add(number)

    # Check paragraphs for citations
    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(r"\n\s*\n", main_text)
        if paragraph.strip()
    ]

    missing_citations = []

    for index, paragraph in enumerate(paragraphs, start=1):
        if paragraph.startswith("#"):
            continue

        if len(paragraph.split()) < 8:
            continue

        if not re.search(citation_pattern, paragraph):
            missing_citations.append(index)

    unused_sources = source_numbers - used_numbers

    lines = [
        "CITATION QUALITY REPORT",
        "=" * 35,
        f"Sources found: {len(source_numbers)}",
        f"Citations found: {len(citations)}",
        "",
        "INVALID SOURCE REFERENCES",
    ]

    if invalid_numbers:
        for number in sorted(invalid_numbers):
            lines.append(
                f"- Source {number} is cited but is not listed."
            )
    else:
        lines.append("- None found.")

    lines.extend(["", "PARAGRAPHS WITHOUT CITATIONS"])

    if missing_citations:
        for number in missing_citations:
            lines.append(
                f"- Paragraph {number} has no recognized citation."
            )
    else:
        lines.append("- None found.")

    lines.extend(["", "UNUSED SOURCES"])

    if unused_sources:
        for number in sorted(unused_sources):
            lines.append(
                f"- Source {number} was not cited in the report."
            )
    else:
        lines.append("- None found.")

    lines.extend([
        "",
        "IMPORTANT LIMITATION",
        "This checks citation formatting and source numbering only.",
        "It does not prove that a source supports a claim.",
        "It does not verify whether the claims are factually correct."
    ])

    result = "\n".join(lines)
    output_path.write_text(result, encoding="utf-8")

    print(result)
    print(f"\nReport saved to: {output_path.resolve()}")


if __name__ == "__main__":
    validate_citations()
