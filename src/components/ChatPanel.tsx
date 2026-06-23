"use client";

import { useEffect, useRef, useState } from "react";
import type { PortfolioScan, ChatMessage, Severity } from "@/lib/types";
import Markdown from "./Markdown";

const SUGGESTS = [
  "What are my blockers?",
  "Explain my readiness score",
  "How long will remediation take?",
  "Why does SELECT * matter on HANA?",
];

export default function ChatPanel({ portfolio }: { portfolio: PortfolioScan }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        `I've analysed **${portfolio.programs.length} program(s)** with an overall readiness of **${portfolio.portfolio_score}/100**. Ask me anything about your findings, effort, or remediation — try a suggestion below.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const findings = portfolio.programs.flatMap((p) =>
    p.findings.map((f) => ({
      title: f.title,
      severity: f.severity as Severity,
      program: p.program_name,
      effort: f.effort,
      lines: f.affected_lines,
    }))
  );

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history,
          programNames: portfolio.programs.map((p) => p.program_name),
          score: portfolio.portfolio_score,
          findings,
          sapRelease: portfolio.sap_release,
          targetRelease: portfolio.target_release,
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer || data.error || "Sorry, something went wrong." },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad">
      <div className="chat-wrap">
        <div className="chat-log" ref={logRef}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "msg-user" : "msg-bot"}`}>
              {m.role === "user" ? m.content : <Markdown source={m.content} />}
            </div>
          ))}
          {busy && (
            <div className="msg msg-bot">
              <span className="spin" /> <span className="muted">thinking<span className="dots" /></span>
            </div>
          )}
        </div>

        <div>
          <div className="chat-suggests">
            {SUGGESTS.map((s) => (
              <span key={s} className="suggest" onClick={() => send(s)}>
                {s}
              </span>
            ))}
          </div>
          <div className="chat-input">
            <input
              placeholder="Ask about your scan results…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              disabled={busy}
            />
            <button className="btn btn-primary" onClick={() => send(input)} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
