"use client";

import { useEffect, useState } from "react";
import type { FlatFinding } from "./Findings";
import Markdown from "./Markdown";

export default function RemediationModal({
  finding,
  onClose,
}: {
  finding: FlatFinding;
  onClose: () => void;
}) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(devQuestion?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programName: finding.program_name,
          findingTitle: finding.title,
          simplificationItem: finding.simplification_item,
          severity: finding.severity,
          ruleId: finding.rule_id,
          affectedCode: finding.code_snippet,
          developerQuestion: devQuestion,
        }),
      });
      const data = await res.json();
      if (data.markdown) setMarkdown(data.markdown);
      else setError(data.error || "Failed to generate remediation");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,8,14,0.78)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 860, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="row"
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--card)",
            zIndex: 2,
          }}
        >
          <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{finding.title}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {finding.program_name} · {finding.simplification_item}
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            ✕ Close <span className="kbd">esc</span>
          </button>
        </div>

        <div className="card-pad">
          {loading && (
            <div className="empty">
              <div className="e-icon">
                <span className="spin" style={{ width: 28, height: 28 }} />
              </div>
              <div>Generating developer-ready remediation guide<span className="dots" /></div>
            </div>
          )}
          {error && !loading && (
            <div className="empty">
              <div className="e-icon">⚠️</div>
              <div>{error}</div>
              <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={() => load()}>
                Retry
              </button>
            </div>
          )}
          {markdown && !loading && <Markdown source={markdown} />}

          {!loading && (
            <>
              <div className="divider" />
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Ask a follow-up about this fix
              </div>
              <div className="chat-input" style={{ marginTop: 0 }}>
                <input
                  placeholder="e.g. How do I handle the transport for this change?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && question.trim()) load(question.trim());
                  }}
                />
                <button
                  className="btn btn-primary"
                  disabled={!question.trim()}
                  onClick={() => load(question.trim())}
                >
                  Ask
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
