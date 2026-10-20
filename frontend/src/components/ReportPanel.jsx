import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

/**
 * ReportPanel — loads and displays the research report with download.
 */
export function ReportPanel({ jobId, topic }) {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    setError("");
    setReport("");

    fetch(`${API}/api/runs/${encodeURIComponent(jobId)}/report`)
      .then((r) => {
        if (!r.ok) throw new Error("Report not available yet.");
        return r.json();
      })
      .then((d) => setReport(d.report ?? d.content ?? ""))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  // Render markdown-like structure from plain text
  function renderReport(text) {
    if (!text) return null;

    return text.split("\n").map((line, i) => {
      if (line.startsWith("# ")) {
        return <h2 key={i} className="rp-h1">{line.slice(2)}</h2>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={i} className="rp-h2">{line.slice(3)}</h3>;
      }
      if (line.startsWith("### ")) {
        return <h4 key={i} className="rp-h3">{line.slice(4)}</h4>;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return <li key={i} className="rp-li">{renderInline(line.slice(2))}</li>;
      }
      if (line.match(/^\d+\. /)) {
        return <li key={i} className="rp-li numbered">{renderInline(line.replace(/^\d+\. /, ""))}</li>;
      }
      if (line.trim() === "" || line.startsWith("===") || line.startsWith("---")) {
        return <div key={i} className="rp-spacer" />;
      }
      return <p key={i} className="rp-p">{renderInline(line)}</p>;
    });
  }

  function renderInline(text) {
    // Detect URLs and make them clickable
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer noopener"
            className="rp-link"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  }

  return (
    <div className="report-panel">
      <div className="rp-header">
        <div>
          <div className="rp-kicker">RESEARCH REPORT</div>
          <h2 className="rp-topic">{topic || "Research Report"}</h2>
        </div>
        <div className="rp-actions">
          {jobId && (
            <a
              className="btn-download"
              href={`${API}/api/runs/${encodeURIComponent(jobId)}/report/download`}
              target="_blank"
              rel="noreferrer"
            >
              ↓ Download Report
            </a>
          )}
        </div>
      </div>

      <div className="rp-body">
        {loading && (
          <div className="rp-loading">
            <div className="rp-spinner" />
            Loading report…
          </div>
        )}

        {error && !loading && (
          <div className="rp-error">
            <span>⚠</span> {error}
          </div>
        )}

        {!loading && !error && report && (
          <div className="rp-content">
            {renderReport(report)}
          </div>
        )}

        {!loading && !error && !report && (
          <div className="rp-empty">
            Report will appear here once the Writer agent completes.
          </div>
        )}
      </div>
    </div>
  );
}
