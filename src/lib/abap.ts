import type { Severity, Effort, Finding } from "./types";

// ── ABAP program helpers ──

/** Derive a clean program name from an uploaded filename. */
export function programNameFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[\/\\]/g, "_");
  return base.toUpperCase().slice(0, 60) || "ZPROGRAM";
}

/** Best-effort program-type detection from source + filename. */
export function detectProgramType(source: string, filename: string): string {
  const s = source.slice(0, 4000);
  const f = filename.toLowerCase();
  if (/^\s*(CLASS|INTERFACE)\b/im.test(s) || f.includes("clas")) return "Class / OO";
  if (/^\s*FUNCTION\b/im.test(s) || f.includes("fugr") || f.includes("func")) return "Function Module";
  if (/^\s*(REPORT|PROGRAM)\b/im.test(s)) return "Report";
  if (/^\s*MODULE\b/im.test(s) || f.includes("dynp")) return "Module Pool";
  if (/DEFINE\s+\w+/i.test(s) && f.includes("incl")) return "Include";
  return "Report";
}

/** Count non-empty, non-comment lines of code. */
export function countLoc(source: string): number {
  return source
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/^\s*\*/.test(l)).length;
}

// ── Scoring ──

const SEVERITY_PENALTY: Record<Severity, number> = {
  BLOCKER: 22,
  HIGH: 12,
  MEDIUM: 6,
  LOW: 2,
  INFO: 0,
};

/** Deterministic 0–100 readiness score derived from findings. */
export function computeReadinessScore(findings: Finding[]): number {
  let penalty = 0;
  for (const f of findings) penalty += SEVERITY_PENALTY[f.severity] ?? 0;
  return Math.max(5, Math.min(100, Math.round(100 - penalty)));
}

// ── Effort aggregation ──

const EFFORT_DAYS: Record<Effort, number> = {
  "< 1 day": 0.5,
  "1–3 days": 2,
  "1 week": 5,
  "> 1 week": 10,
};

/** Sum per-finding effort into a human phrase + day estimate. */
export function aggregateEffort(findings: Finding[]): { phrase: string; days: number } {
  let days = 0;
  for (const f of findings) days += EFFORT_DAYS[f.effort as Effort] ?? 1;
  let phrase: string;
  if (days <= 1) phrase = "< 1 day";
  else if (days <= 5) phrase = `~${Math.round(days)} days`;
  else if (days <= 20) phrase = `~${(days / 5).toFixed(1)} weeks`;
  else phrase = `~${(days / 20).toFixed(1)} months`;
  return { phrase, days: Math.round(days * 10) / 10 };
}

/** Map effort label to a 0–1 axis position for the heatmap. */
export function effortToAxis(effort: string): number {
  switch (effort) {
    case "< 1 day": return 0.15;
    case "1–3 days": return 0.4;
    case "1 week": return 0.65;
    case "> 1 week": return 0.9;
    default: return 0.5;
  }
}

/** Map a program's worst severity to a 0–1 risk axis position. */
export function severityToAxis(sev: Severity): number {
  switch (sev) {
    case "BLOCKER": return 0.92;
    case "HIGH": return 0.72;
    case "MEDIUM": return 0.5;
    case "LOW": return 0.28;
    default: return 0.12;
  }
}
