// ── Shared domain types for the ABAP Modernization Copilot ──

export type Severity = "BLOCKER" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type Effort = "< 1 day" | "1–3 days" | "1 week" | "> 1 week";

export const SEVERITY_ORDER: Severity[] = [
  "BLOCKER",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
];

/** A simplification-item rule loaded from YAML. */
export interface Rule {
  id: string;
  simplification_item: string;
  title: string;
  category: string;
  severity: Severity;
  effort: Effort;
  patterns: string[]; // regex source strings
  description: string;
  root_cause: string;
  business_impact: string;
  remediation: string;
  sap_note: string;
  references?: string[];
}

/** One pattern hit produced by the rules engine. */
export interface RuleMatch {
  rule_id: string;
  simplification_item: string;
  title: string;
  category: string;
  severity: Severity;
  effort: Effort;
  matched_lines: number[];
  snippets: { line: number; text: string }[];
}

/** A single finding (rules-engine baseline, optionally augmented by Claude). */
export interface Finding {
  id: string;
  title: string;
  simplification_item: string;
  category: string;
  severity: Severity;
  affected_lines: number[];
  root_cause: string;
  business_impact: string;
  remediation: string;
  code_snippet: string;
  effort: Effort;
  sap_note: string;
}

/** Result of scanning a single ABAP program. */
export interface ProgramScan {
  program_name: string;
  program_type: string;
  loc: number;
  readiness_score: number;
  findings: Finding[];
  top_risks: string[];
  quick_win: string;
  total_effort: string;
  summary: string;
  source: string; // raw ABAP, retained for remediation deep-dives
}

/** Aggregate result across all uploaded programs. */
export interface PortfolioScan {
  customer_name: string;
  sap_release: string;
  target_release: string;
  scanned_at: string;
  engine: "claude" | "demo";
  model?: string;
  programs: ProgramScan[];
  portfolio_score: number;
  total_loc: number;
  counts: Record<Severity, number>;
  total_effort: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
