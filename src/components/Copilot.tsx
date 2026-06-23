"use client";

import { useState } from "react";
import type { PortfolioScan } from "@/lib/types";
import Uploader, { UploadFile, ScanMeta } from "./Uploader";
import ScanProgress from "./ScanProgress";
import Dashboard from "./Dashboard";

type Phase = "idle" | "scanning" | "done";

export default function Copilot() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [portfolio, setPortfolio] = useState<PortfolioScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string[]>([]);

  async function runScan(files: UploadFile[], meta: ScanMeta) {
    setError(null);
    setScanning(files.map((f) => f.name));
    setPhase("scanning");
    const started = Date.now();
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, ...meta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scan failed");
        setPhase("idle");
        return;
      }
      // Keep the progress animation visible for at least a beat.
      const elapsed = Date.now() - started;
      if (elapsed < 1400) await new Promise((r) => setTimeout(r, 1400 - elapsed));
      setPortfolio(data as PortfolioScan);
      setPhase("done");
    } catch {
      setError("Network error — is the server running?");
      setPhase("idle");
    }
  }

  function reset() {
    setPortfolio(null);
    setPhase("idle");
    setError(null);
  }

  return (
    <div className="page">
      {phase === "idle" && (
        <>
          <div className="section" style={{ marginTop: 8 }}>
            <div className="section-header">
              <div className="section-icon icon-green">📂</div>
              <div>
                <div className="section-title">Upload ABAP for analysis</div>
                <div className="section-subtitle">
                  Drag in programs or a .zip, or load the bundled sample set to try it instantly.
                </div>
              </div>
            </div>
            <Uploader onScan={runScan} busy={false} />
            {error && (
              <p className="fdesc" style={{ color: "var(--warn)", marginTop: 14 }}>⚠️ {error}</p>
            )}
          </div>
        </>
      )}

      {phase === "scanning" && (
        <div className="section" style={{ marginTop: 24 }}>
          <ScanProgress fileNames={scanning} />
        </div>
      )}

      {phase === "done" && portfolio && (
        <div className="section" style={{ marginTop: 24 }}>
          <Dashboard portfolio={portfolio} onReset={reset} />
        </div>
      )}
    </div>
  );
}
