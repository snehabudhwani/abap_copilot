"use client";

import { useState } from "react";
import type { Finding } from "@/lib/types";

export interface FlatFinding extends Finding {
  program_name: string;
  rule_id: string;
}

function ruleIdOf(f: Finding): string {
  // ids are "<RULE_ID>__<n>" in demo mode; fall back to simplification item.
  const m = f.id.match(/^([A-Z0-9_]+)__\d+$/);
  return m ? m[1] : f.id;
}

export function flatten(programs: { program_name: string; findings: Finding[] }[]): FlatFinding[] {
  const out: FlatFinding[] = [];
  for (const p of programs) {
    for (const f of p.findings) {
      out.push({ ...f, program_name: p.program_name, rule_id: ruleIdOf(f) });
    }
  }
  return out;
}

function FindingRow({
  f,
  onRemediate,
}: {
  f: FlatFinding;
  onRemediate: (f: FlatFinding) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="finding" onClick={() => setOpen((o) => !o)}>
      <div className="finding-top">
        <span className={`sev sev-${f.severity}`}>{f.severity}</span>
        <span className="finding-title">{f.title}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
          {open ? "▾" : "▸"}
        </span>
      </div>
      <div className="finding-meta">
        <span className="pill">📄 {f.program_name}</span>
        <span>🏷 {f.simplification_item}</span>
        <span>📍 lines {f.affected_lines.slice(0, 6).join(", ")}{f.affected_lines.length > 6 ? "…" : ""}</span>
        <span>⏱ {f.effort}</span>
        <span>🗂 {f.category}</span>
      </div>

      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <div className="divider" />
          {f.root_cause && (
            <>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Root cause</div>
              <p className="fdesc">{f.root_cause}</p>
            </>
          )}
          {f.business_impact && (
            <>
              <div className="mono" style={{ fontSize: 10, color: "var(--warn)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "12px 0 4px" }}>Business impact</div>
              <p className="fdesc">{f.business_impact}</p>
            </>
          )}
          {f.remediation && (
            <>
              <div className="mono" style={{ fontSize: 10, color: "var(--accent3)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "12px 0 4px" }}>Remediation</div>
              <p className="fdesc">{f.remediation}</p>
            </>
          )}
          {f.code_snippet && (
            <pre className="code" style={{ marginTop: 12 }}>{f.code_snippet}</pre>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btn-sm btn-primary" onClick={() => onRemediate(f)}>
              🔧 Remediation deep dive
            </button>
            <span className="spacer" />
            <span className="badge-note">SAP Note: {f.sap_note}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FindingsList({
  findings,
  onRemediate,
}: {
  findings: FlatFinding[];
  onRemediate: (f: FlatFinding) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="empty">
        <div className="e-icon">✅</div>
        <div>No findings in this view.</div>
      </div>
    );
  }
  return (
    <div>
      {findings.map((f, i) => (
        <FindingRow key={`${f.id}-${i}`} f={f} onRemediate={onRemediate} />
      ))}
    </div>
  );
}
