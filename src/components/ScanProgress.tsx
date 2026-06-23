"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Tokenizing ABAP source",
  "Matching simplification-item rules",
  "Classifying severity & effort",
  "Augmenting findings with Claude",
  "Scoring migration readiness",
  "Aggregating portfolio report",
];

export default function ScanProgress({ fileNames }: { fileNames: string[] }) {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setDone((d) => (d < fileNames.length ? d + 1 : d));
    }, 420);
    return () => clearInterval(id);
  }, [fileNames.length]);

  const [stage, setStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card card-pad">
      <div className="row" style={{ marginBottom: 18 }}>
        <span className="spin" style={{ width: 20, height: 20 }} />
        <div>
          <div style={{ fontWeight: 600 }}>{STAGES[stage]}<span className="dots" /></div>
          <div className="badge-note">Analyzing {fileNames.length} program(s) against the simplification-item catalog</div>
        </div>
      </div>
      <div>
        {fileNames.map((name, i) => (
          <div className="scan-line" key={name}>
            {i < done ? (
              <span style={{ color: "var(--accent3)" }}>✓</span>
            ) : (
              <span className="spin" />
            )}
            <span className="mono" style={{ fontSize: 12.5 }}>{name}</span>
            <span className="spacer" />
            <span className="badge-note">{i < done ? "scanned" : "queued"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
