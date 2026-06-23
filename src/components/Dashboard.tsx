"use client";

import { useMemo, useState } from "react";
import type { PortfolioScan, Severity } from "@/lib/types";
import { SEVERITY_ORDER } from "@/lib/types";
import ScoreGauge from "./ScoreGauge";
import Heatmap from "./Heatmap";
import FindingsList, { flatten, FlatFinding } from "./Findings";
import RemediationModal from "./RemediationModal";
import ReportPanel from "./ReportPanel";
import ChatPanel from "./ChatPanel";

type Tab = "overview" | "findings" | "report" | "chat";

const SEV_DOT: Record<Severity, string> = {
  BLOCKER: "var(--sev-blocker)",
  HIGH: "var(--sev-high)",
  MEDIUM: "var(--sev-medium)",
  LOW: "var(--sev-low)",
  INFO: "var(--sev-info)",
};

export default function Dashboard({
  portfolio,
  onReset,
}: {
  portfolio: PortfolioScan;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [sevFilter, setSevFilter] = useState<Severity | "ALL">("ALL");
  const [active, setActive] = useState<FlatFinding | null>(null);

  const allFindings = useMemo(() => flatten(portfolio.programs), [portfolio]);
  const totalFindings = allFindings.length;

  const filtered = useMemo(
    () =>
      sevFilter === "ALL"
        ? allFindings
        : allFindings.filter((f) => f.severity === sevFilter),
    [allFindings, sevFilter]
  );

  const topRisks = Array.from(
    new Set(
      portfolio.programs
        .flatMap((p) => p.top_risks)
        .filter((r) => r && !/^No (incompatibilities|significant)/i.test(r))
    )
  ).slice(0, 4);
  const quickWin = portfolio.programs
    .map((p) => p.quick_win)
    .find((q) => q && !/^Nothing/.test(q));

  return (
    <div>
      {/* ── Summary band ── */}
      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <div className="score-wrap">
          <ScoreGauge score={portfolio.portfolio_score} label="Portfolio" />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{portfolio.customer_name}</div>
                <div className="badge-note">
                  {portfolio.sap_release} → {portfolio.target_release} ·{" "}
                  {portfolio.engine === "claude" ? `Claude (${portfolio.model})` : "Demo engine"}
                </div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={onReset}>
                ↺ New scan
              </button>
            </div>
            <div className="stat-grid">
              <div className="stat">
                <b>{portfolio.programs.length}</b>
                <span>Programs</span>
              </div>
              <div className="stat">
                <b>{portfolio.total_loc.toLocaleString()}</b>
                <span>Lines</span>
              </div>
              <div className="stat">
                <b style={{ color: SEV_DOT.BLOCKER }}>{portfolio.counts.BLOCKER}</b>
                <span>Blockers</span>
              </div>
              <div className="stat">
                <b style={{ color: SEV_DOT.HIGH }}>{portfolio.counts.HIGH}</b>
                <span>High</span>
              </div>
              <div className="stat">
                <b style={{ color: SEV_DOT.MEDIUM }}>{portfolio.counts.MEDIUM}</b>
                <span>Medium</span>
              </div>
              <div className="stat">
                <b>{portfolio.total_effort}</b>
                <span>Est. effort</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <div className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
          📊 Overview
        </div>
        <div className={`tab ${tab === "findings" ? "active" : ""}`} onClick={() => setTab("findings")}>
          🔍 Findings <span className="count">{totalFindings}</span>
        </div>
        <div className={`tab ${tab === "report" ? "active" : ""}`} onClick={() => setTab("report")}>
          📄 Report
        </div>
        <div className={`tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
          💬 Ask Copilot
        </div>
      </div>

      {/* ── Overview tab ── */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20, alignItems: "start" }} className="overview-grid">
            <div>
              <div className="section-title" style={{ marginBottom: 12 }}>Risk vs. Effort heatmap</div>
              <Heatmap programs={portfolio.programs} />
            </div>
            <div>
              <div className="section-title" style={{ marginBottom: 12 }}>Priorities</div>
              {quickWin && (
                <div className="card card-pad" style={{ marginBottom: 12, borderColor: "rgba(0,255,156,0.25)" }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--accent3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>⚡ Quick win</div>
                  <p className="fdesc">{quickWin}</p>
                </div>
              )}
              <div className="card card-pad">
                <div className="mono" style={{ fontSize: 10, color: "var(--warn)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Top risk areas</div>
                {topRisks.length === 0 ? (
                  <p className="fdesc">No significant risks detected.</p>
                ) : (
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    {topRisks.map((r, i) => (
                      <li key={i} className="fdesc" style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--warn)" }}>▸</span> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="section-title" style={{ margin: "26px 0 12px" }}>Programs</div>
          {portfolio.programs.map((p, i) => (
            <div className="card card-pad" key={i} style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="mono" style={{ color: "var(--accent)", fontSize: 13.5 }}>{p.program_name}</span>
                    <span className="badge-note">{p.program_type} · {p.loc} LOC</span>
                  </div>
                  <p className="fdesc" style={{ marginTop: 8 }}>{p.summary}</p>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    {SEVERITY_ORDER.map((sev) => {
                      const n = p.findings.filter((f) => f.severity === sev).length;
                      if (!n) return null;
                      return <span key={sev} className={`sev sev-${sev}`}>{n} {sev}</span>;
                    })}
                    {p.findings.length === 0 && <span className="sev sev-INFO">CLEAN</span>}
                  </div>
                </div>
                <ScoreGauge score={p.readiness_score} label="Score" size={84} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Findings tab ── */}
      {tab === "findings" && (
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span
              className="suggest"
              style={{ borderColor: sevFilter === "ALL" ? "var(--accent)" : "var(--border)", color: sevFilter === "ALL" ? "var(--accent)" : "var(--label)" }}
              onClick={() => setSevFilter("ALL")}
            >
              All ({totalFindings})
            </span>
            {SEVERITY_ORDER.map((sev) => {
              const n = allFindings.filter((f) => f.severity === sev).length;
              if (!n) return null;
              return (
                <span
                  key={sev}
                  className="suggest"
                  style={{
                    borderColor: sevFilter === sev ? SEV_DOT[sev] : "var(--border)",
                    color: sevFilter === sev ? SEV_DOT[sev] : "var(--label)",
                  }}
                  onClick={() => setSevFilter(sev)}
                >
                  {sev} ({n})
                </span>
              );
            })}
          </div>
          <FindingsList findings={filtered} onRemediate={setActive} />
        </div>
      )}

      {/* ── Report tab ── */}
      {tab === "report" && <ReportPanel portfolio={portfolio} />}

      {/* ── Chat tab ── */}
      {tab === "chat" && <ChatPanel portfolio={portfolio} />}

      {active && <RemediationModal finding={active} onClose={() => setActive(null)} />}
    </div>
  );
}
