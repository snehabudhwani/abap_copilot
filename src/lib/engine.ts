// ───────────────────────────────────────────────────────────────────────────
// Orchestrator — routes scan / report / remediate / chat to real Claude when a
// key is configured, otherwise to the deterministic demo engine. Any Claude
// failure degrades gracefully to the demo engine so the app never hard-fails.
// ───────────────────────────────────────────────────────────────────────────

import { isLive, activeModel, complete, chat, extractJson } from "./claude";
import { scanSource } from "./rulesEngine";
import {
  countLoc,
  detectProgramType,
  programNameFromFile,
  computeReadinessScore,
  aggregateEffort,
} from "./abap";
import {
  SYSTEM_PROMPT,
  scanPrompt,
  reportPrompt,
  remediatePrompt,
  chatPrompt,
} from "./prompts";
import {
  mockScanProgram,
  mockRemediation,
  mockReportNarrative,
  mockChat,
} from "./mockEngine";
import { SEVERITY_ORDER } from "./types";
import type {
  ProgramScan,
  PortfolioScan,
  Finding,
  Severity,
  ChatMessage,
} from "./types";

const VALID_SEV: Severity[] = SEVERITY_ORDER;

function coerceSeverity(v: unknown): Severity {
  const s = String(v ?? "").toUpperCase();
  return (VALID_SEV.includes(s as Severity) ? s : "MEDIUM") as Severity;
}

// ── Single program scan ──

export async function scanProgram(filename: string, source: string): Promise<ProgramScan> {
  if (!isLive()) return mockScanProgram(filename, source);

  try {
    const program_name = programNameFromFile(filename);
    const program_type = detectProgramType(source, filename);
    const loc = countLoc(source);
    const matches = scanSource(source);

    const prompt = scanPrompt({
      programName: program_name,
      programType: program_type,
      loc,
      timestamp: new Date().toISOString(),
      matchedRulesJson: JSON.stringify(
        matches.map((m) => ({
          id: m.rule_id,
          simplification_item: m.simplification_item,
          severity: m.severity,
          lines: m.matched_lines,
        })),
        null,
        2
      ),
      abapSource: source,
    });

    const raw = await complete(SYSTEM_PROMPT, prompt, { maxTokens: 4096 });
    const parsed = extractJson<{
      readiness_score?: number;
      findings?: Partial<Finding>[];
      top_risks?: string[];
      quick_win?: string;
      total_effort?: string;
      summary?: string;
    }>(raw);

    const findings: Finding[] = (parsed.findings ?? []).map((f, i) => ({
      id: f.id ?? `finding__${i}`,
      title: f.title ?? "Untitled finding",
      simplification_item: f.simplification_item ?? "Verify in SAP Launchpad",
      category: f.category ?? "General",
      severity: coerceSeverity(f.severity),
      affected_lines: Array.isArray(f.affected_lines) ? f.affected_lines : [],
      root_cause: f.root_cause ?? "",
      business_impact: f.business_impact ?? "",
      remediation: f.remediation ?? "",
      code_snippet: f.code_snippet ?? "",
      effort: (f.effort as Finding["effort"]) ?? "1–3 days",
      sap_note: f.sap_note ?? "Verify in SAP Launchpad",
    }));

    const readiness_score =
      typeof parsed.readiness_score === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.readiness_score)))
        : computeReadinessScore(findings);

    return {
      program_name,
      program_type,
      loc,
      readiness_score,
      findings,
      top_risks: parsed.top_risks ?? [],
      quick_win: parsed.quick_win ?? "",
      total_effort: parsed.total_effort ?? aggregateEffort(findings).phrase,
      summary: parsed.summary ?? "",
      source,
    };
  } catch (err) {
    console.error("[engine] Claude scan failed, falling back to demo:", err);
    return mockScanProgram(filename, source);
  }
}

// ── Portfolio aggregation ──

export function buildPortfolio(
  programs: ProgramScan[],
  meta: { customer_name: string; sap_release: string; target_release: string }
): PortfolioScan {
  const counts: Record<Severity, number> = {
    BLOCKER: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  let total_loc = 0;
  const allFindings: Finding[] = [];

  for (const p of programs) {
    total_loc += p.loc;
    for (const f of p.findings) {
      counts[f.severity]++;
      allFindings.push(f);
    }
  }

  const portfolio_score =
    programs.length === 0
      ? 100
      : Math.round(programs.reduce((s, p) => s + p.readiness_score, 0) / programs.length);

  return {
    customer_name: meta.customer_name,
    sap_release: meta.sap_release,
    target_release: meta.target_release,
    scanned_at: new Date().toISOString(),
    engine: isLive() ? "claude" : "demo",
    model: isLive() ? activeModel() : undefined,
    programs,
    portfolio_score,
    total_loc,
    counts,
    total_effort: aggregateEffort(allFindings).phrase,
  };
}

// ── Executive report narrative ──

export async function reportNarrative(portfolio: PortfolioScan): Promise<string> {
  const topFindings = collectTopFindings(portfolio, 10);
  const topItems = collectTopItems(portfolio, 6);
  const programNames = portfolio.programs.map((p) => p.program_name);

  if (!isLive()) {
    return mockReportNarrative({
      customerName: portfolio.customer_name,
      totalPrograms: portfolio.programs.length,
      totalLoc: portfolio.total_loc,
      portfolioScore: portfolio.portfolio_score,
      counts: portfolio.counts,
      totalEffort: portfolio.total_effort,
      topFindings: topFindings.map((f) => ({
        title: f.title,
        severity: f.severity,
        program: f.program,
      })),
      topItems,
      programNames,
    });
  }

  try {
    const prompt = reportPrompt({
      customerName: portfolio.customer_name,
      totalPrograms: portfolio.programs.length,
      totalLoc: portfolio.total_loc,
      portfolioScore: portfolio.portfolio_score,
      blockerCount: portfolio.counts.BLOCKER,
      highCount: portfolio.counts.HIGH,
      mediumCount: portfolio.counts.MEDIUM,
      totalEffort: portfolio.total_effort,
      topFindingsJson: JSON.stringify(topFindings, null, 2),
      topSimplificationItems: topItems
        .map((t) => `- ${t.item} (${t.count}×)`)
        .join("\n"),
    });
    return await complete(SYSTEM_PROMPT, prompt, { maxTokens: 3000 });
  } catch (err) {
    console.error("[engine] Claude report failed, falling back to demo:", err);
    return mockReportNarrative({
      customerName: portfolio.customer_name,
      totalPrograms: portfolio.programs.length,
      totalLoc: portfolio.total_loc,
      portfolioScore: portfolio.portfolio_score,
      counts: portfolio.counts,
      totalEffort: portfolio.total_effort,
      topFindings: topFindings.map((f) => ({
        title: f.title,
        severity: f.severity,
        program: f.program,
      })),
      topItems,
      programNames,
    });
  }
}

// ── Remediation deep dive ──

export async function remediate(args: {
  programName: string;
  findingTitle: string;
  simplificationItem: string;
  severity: string;
  ruleId: string;
  affectedCode: string;
  developerQuestion?: string;
}): Promise<string> {
  if (!isLive()) return mockRemediation(args);
  try {
    const prompt = remediatePrompt({
      programName: args.programName,
      findingTitle: args.findingTitle,
      simplificationItem: args.simplificationItem,
      severity: args.severity,
      affectedCode: args.affectedCode,
      developerQuestion: args.developerQuestion ?? "",
    });
    return await complete(SYSTEM_PROMPT, prompt, { maxTokens: 3000 });
  } catch (err) {
    console.error("[engine] Claude remediation failed, falling back to demo:", err);
    return mockRemediation(args);
  }
}

// ── Chat ──

export async function chatAnswer(args: {
  question: string;
  history: ChatMessage[];
  programNames: string[];
  score: number;
  findings: { title: string; severity: Severity; program: string; effort: string; lines: number[] }[];
  sapRelease: string;
  targetRelease: string;
}): Promise<string> {
  if (!isLive()) {
    return mockChat({
      question: args.question,
      programNames: args.programNames,
      score: args.score,
      findings: args.findings,
      history: args.history,
      sapRelease: args.sapRelease,
      targetRelease: args.targetRelease,
    });
  }

  try {
    const system =
      SYSTEM_PROMPT +
      "\n\n" +
      chatPrompt({
        programList: args.programNames.join(", "),
        score: args.score,
        findingsSummaryJson: JSON.stringify(args.findings.slice(0, 20), null, 2),
        sapRelease: args.sapRelease,
        targetRelease: args.targetRelease,
        userQuestion: args.question,
      });
    const messages: ChatMessage[] = [
      ...args.history.slice(-8),
      { role: "user", content: args.question },
    ];
    return await chat(system, messages, { maxTokens: 1600 });
  } catch (err) {
    console.error("[engine] Claude chat failed, falling back to demo:", err);
    return mockChat({
      question: args.question,
      programNames: args.programNames,
      score: args.score,
      findings: args.findings,
      history: args.history,
      sapRelease: args.sapRelease,
      targetRelease: args.targetRelease,
    });
  }
}

// ── helpers ──

interface TopFinding {
  title: string;
  severity: Severity;
  program: string;
  simplification_item: string;
}

function collectTopFindings(portfolio: PortfolioScan, n: number): TopFinding[] {
  const all: TopFinding[] = [];
  for (const p of portfolio.programs) {
    for (const f of p.findings) {
      all.push({
        title: f.title,
        severity: f.severity,
        program: p.program_name,
        simplification_item: f.simplification_item,
      });
    }
  }
  all.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  return all.slice(0, n);
}

function collectTopItems(portfolio: PortfolioScan, n: number): { item: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of portfolio.programs) {
    for (const f of p.findings) {
      counts.set(f.simplification_item, (counts.get(f.simplification_item) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([item, count]) => ({ item, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
