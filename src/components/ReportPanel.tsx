"use client";

import { useState } from "react";
import type { PortfolioScan } from "@/lib/types";
import Markdown from "./Markdown";

export default function ReportPanel({ portfolio }: { portfolio: PortfolioScan }) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await fetch("/api/report?preview=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(portfolio),
      });
      const data = await res.json();
      if (data.narrative) setNarrative(data.narrative);
      else setError(data.error || "Failed to generate narrative");
    } catch {
      setError("Network error");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(portfolio),
      });
      if (!res.ok) {
        setError("Report generation failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = portfolio.customer_name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
      a.download = `s4hana_readiness_${safe || "report"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Executive Migration Readiness Report</div>
            <div className="badge-note" style={{ marginTop: 4 }}>
              Consulting-grade narrative + per-program detail, exported as a Word (.docx) document.
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={preview} disabled={loadingPreview}>
              {loadingPreview ? <><span className="spin" /> Building…</> : "👁 Preview summary"}
            </button>
            <button className="btn btn-primary" onClick={download} disabled={downloading}>
              {downloading ? <><span className="spin" /> Generating…</> : "📄 Download Word report"}
            </button>
          </div>
        </div>
        {error && (
          <p className="fdesc" style={{ color: "var(--warn)", marginTop: 12 }}>⚠️ {error}</p>
        )}
      </div>

      {narrative ? (
        <div className="card card-pad">
          <Markdown source={narrative} />
        </div>
      ) : (
        !loadingPreview && (
          <div className="empty">
            <div className="e-icon">📑</div>
            <div>Click <strong>Preview summary</strong> to generate the executive narrative,</div>
            <div>or <strong>Download Word report</strong> for the full .docx deliverable.</div>
          </div>
        )
      )}
    </div>
  );
}
