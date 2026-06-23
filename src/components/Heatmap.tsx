"use client";

import { useState } from "react";
import type { ProgramScan, Severity } from "@/lib/types";
import { effortToAxis, severityToAxis } from "@/lib/abap";
import { SEVERITY_ORDER } from "@/lib/types";

const SEV_COLOR: Record<Severity, string> = {
  BLOCKER: "var(--sev-blocker)",
  HIGH: "var(--sev-high)",
  MEDIUM: "var(--sev-medium)",
  LOW: "var(--sev-low)",
  INFO: "var(--sev-info)",
};

function worstSeverity(p: ProgramScan): Severity {
  let worst: Severity = "INFO";
  for (const f of p.findings) {
    if (SEVERITY_ORDER.indexOf(f.severity) < SEVERITY_ORDER.indexOf(worst)) worst = f.severity;
  }
  return worst;
}

function worstEffort(p: ProgramScan): string {
  const order = ["< 1 day", "1–3 days", "1 week", "> 1 week"];
  let worst = "< 1 day";
  for (const f of p.findings) {
    if (order.indexOf(f.effort) > order.indexOf(worst)) worst = f.effort;
  }
  return worst;
}

export default function Heatmap({ programs }: { programs: ProgramScan[] }) {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div>
      <div className="heatmap">
        {/* quadrant grid lines */}
        <div className="heat-grid-line" style={{ left: "50%", top: 0, bottom: 0, width: 1 }} />
        <div className="heat-grid-line" style={{ top: "50%", left: 0, right: 0, height: 1 }} />

        {/* quadrant labels */}
        <span className="heat-axis-y" style={{ left: 10, top: 8 }}>Quick wins</span>
        <span className="heat-axis-y" style={{ right: 10, top: 8, textAlign: "right" }}>Critical &amp; costly</span>
        <span className="heat-axis-y" style={{ left: 10, bottom: 8 }}>Low priority</span>
        <span className="heat-axis-y" style={{ right: 10, bottom: 8, textAlign: "right" }}>Schedule later</span>

        {programs.map((p, i) => {
          const sev = worstSeverity(p);
          const x = severityToAxis(sev); // risk on x
          const y = effortToAxis(worstEffort(p)); // effort on y
          return (
            <div
              key={i}
              className="heat-dot"
              style={{
                left: `${x * 100}%`,
                bottom: `${y * 100}%`,
                background: SEV_COLOR[sev],
                boxShadow: hover === i ? `0 0 12px ${SEV_COLOR[sev]}` : "none",
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              title={`${p.program_name} — risk ${sev}, effort ${worstEffort(p)}`}
            />
          );
        })}

        {hover !== null && (
          <div
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontFamily: "var(--mono)",
              maxWidth: "60%",
              pointerEvents: "none",
            }}
          >
            <b style={{ color: "var(--text)" }}>{programs[hover].program_name}</b>
            <div style={{ color: "var(--muted)" }}>
              risk {worstSeverity(programs[hover])} · effort {worstEffort(programs[hover])} · score{" "}
              {programs[hover].readiness_score}
            </div>
          </div>
        )}
      </div>
      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>
          ← LOWER RISK&nbsp;&nbsp;·&nbsp;&nbsp;X-AXIS: SEVERITY&nbsp;&nbsp;·&nbsp;&nbsp;HIGHER RISK →
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>
          Y-AXIS: REMEDIATION EFFORT ↑
        </span>
      </div>
    </div>
  );
}
