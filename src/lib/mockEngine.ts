// ───────────────────────────────────────────────────────────────────────────
// Deterministic DEMO engine. Produces realistic scans, remediation guides,
// report narratives, and chat answers WITHOUT any LLM — so the public demo
// works end-to-end with no API key and no cost. When a key is present the
// orchestrator (engine.ts) routes to real Claude instead.
// ───────────────────────────────────────────────────────────────────────────

import { getRule, scanSource } from "./rulesEngine";
import {
  countLoc,
  detectProgramType,
  programNameFromFile,
  computeReadinessScore,
  aggregateEffort,
} from "./abap";
import { SEVERITY_ORDER } from "./types";
import type { Finding, ProgramScan, Severity, ChatMessage } from "./types";

function sevRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

/** Build a single program scan from rules-engine matches (no LLM). */
export function mockScanProgram(filename: string, source: string): ProgramScan {
  const program_name = programNameFromFile(filename);
  const program_type = detectProgramType(source, filename);
  const loc = countLoc(source);
  const matches = scanSource(source);

  const findings: Finding[] = matches.map((m, idx) => {
    const rule = getRule(m.rule_id);
    const snippet = m.snippets.map((s) => `${String(s.line).padStart(4)}: ${s.text}`).join("\n");
    return {
      id: `${m.rule_id}__${idx}`,
      title: m.title,
      simplification_item: m.simplification_item,
      category: m.category,
      severity: m.severity,
      affected_lines: m.matched_lines,
      root_cause: rule?.root_cause ?? "",
      business_impact: rule?.business_impact ?? "",
      remediation: rule?.remediation ?? "",
      code_snippet: snippet,
      effort: m.effort,
      sap_note: rule?.sap_note ?? "Verify in SAP Launchpad",
    };
  });

  // Order findings by severity, then by how many lines they touch.
  findings.sort(
    (a, b) =>
      sevRank(a.severity) - sevRank(b.severity) ||
      b.affected_lines.length - a.affected_lines.length
  );

  const readiness_score = findings.length === 0 ? 100 : computeReadinessScore(findings);
  const { phrase: total_effort } = aggregateEffort(findings);

  const top_risks = topRisks(findings);
  const quick_win = quickWin(findings);
  const summary = buildSummary(program_name, program_type, loc, findings, readiness_score);

  return {
    program_name,
    program_type,
    loc,
    readiness_score,
    findings,
    top_risks,
    quick_win,
    total_effort,
    summary,
    source,
  };
}

function topRisks(findings: Finding[]): string[] {
  if (findings.length === 0) return ["No incompatibilities detected by the rules engine."];
  const seen = new Set<string>();
  const risks: string[] = [];
  for (const f of findings) {
    const key = f.category;
    if (seen.has(key)) continue;
    seen.add(key);
    risks.push(`${f.category}: ${f.title}`);
    if (risks.length === 3) break;
  }
  return risks;
}

function quickWin(findings: Finding[]): string {
  if (findings.length === 0) return "Nothing to remediate — program is S/4HANA-ready.";
  // Lowest-effort, highest-severity finding = best bang for the buck.
  const ranked = [...findings].sort((a, b) => {
    const effortRank = (e: string) =>
      ["< 1 day", "1–3 days", "1 week", "> 1 week"].indexOf(e);
    return (
      effortRank(a.effort) - effortRank(b.effort) ||
      sevRank(a.severity) - sevRank(b.severity)
    );
  });
  const f = ranked[0];
  return `${f.title} (${f.effort}, ${f.severity}) — line ${f.affected_lines[0]}.`;
}

function buildSummary(
  name: string,
  type: string,
  loc: number,
  findings: Finding[],
  score: number
): string {
  if (findings.length === 0) {
    return `${name} (${type}, ${loc} LOC) passed all ${countLoc("")}rules-engine checks with no S/4HANA simplification-item conflicts detected. The program scores ${score}/100 for migration readiness and can proceed to functional regression testing without code changes.`;
  }
  const counts = countBy(findings);
  const blockers = counts.BLOCKER ?? 0;
  const highs = counts.HIGH ?? 0;
  const lead =
    blockers > 0
      ? `${name} contains ${blockers} blocking incompatibilit${blockers === 1 ? "y" : "ies"} that must be resolved before migration.`
      : highs > 0
        ? `${name} has no hard blockers but carries ${highs} high-severity issue${highs === 1 ? "" : "s"} requiring attention.`
        : `${name} has only advisory findings and is largely S/4HANA-ready.`;
  const themes = [...new Set(findings.map((f) => f.category))].slice(0, 3).join(", ");
  return `${lead} This ${type.toLowerCase()} (${loc} LOC) triggered ${findings.length} simplification-item finding${findings.length === 1 ? "" : "s"} across ${themes}. The readiness score is ${score}/100. Prioritised remediation should begin with the ${blockers > 0 ? "blocking" : "highest-severity"} findings, after which the program can enter regression testing.`;
}

function countBy(findings: Finding[]): Partial<Record<Severity, number>> {
  const c: Partial<Record<Severity, number>> = {};
  for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1;
  return c;
}

// ───────────────────────────────────────────────────────────────────────────
// Remediation deep-dive (mock) — before/after code library + generic fallback.
// ───────────────────────────────────────────────────────────────────────────

interface BeforeAfter {
  before: string;
  after: string;
}

const CODE_LIBRARY: Record<string, BeforeAfter> = {
  SELECT_STAR: {
    before: `* ISSUE: SELECT * materialises every column of a wide HANA table
SELECT * FROM mara
  INTO TABLE @DATA(lt_mara)
  WHERE mtart = @lv_mtart.`,
    after: `* NOTE: project only the columns actually used
SELECT matnr, mtart, matkl, meins
  FROM mara
  INTO TABLE @DATA(lt_mara)
  WHERE mtart = @lv_mtart.`,
  },
  OBSOLETE_INTERNAL_TABLE: {
    before: `* ISSUE: header line + OCCURS is illegal in OO / strict S/4 ABAP
DATA: lt_items TYPE TABLE OF vbap OCCURS 0 WITH HEADER LINE.
LOOP AT lt_items.
  WRITE: / lt_items-posnr.
ENDLOOP.`,
    after: `* NOTE: explicit work area, modern table type, INTO work area
DATA lt_items TYPE STANDARD TABLE OF vbap.
DATA ls_item  TYPE vbap.
LOOP AT lt_items INTO ls_item.
  cl_demo_output=>write( ls_item-posnr ).
ENDLOOP.`,
  },
  SELECT_NO_ORDER_BY: {
    before: `* ISSUE: "first row" depends on order HANA does not guarantee
SELECT SINGLE bukrs waers
  FROM t001
  INTO (lv_bukrs, lv_waers).`,
    after: `* NOTE: supply the full key (or an explicit ORDER BY) for a deterministic row
SELECT SINGLE bukrs, waers
  FROM t001
  WHERE bukrs = @lv_company
  INTO (@lv_bukrs, @lv_waers).`,
  },
  FI_ACDOCA_SECONDARY_INDEX: {
    before: `* ISSUE: BSIS no longer maintained as a transparent table in S/4HANA
SELECT * FROM bsis
  INTO TABLE @DATA(lt_open)
  WHERE bukrs = @lv_bukrs
    AND hkont = @lv_account.`,
    after: `* NOTE: read from the Universal Journal (ACDOCA) or the compatibility view
SELECT rbukrs, racct, hsl, budat
  FROM acdoca
  INTO TABLE @DATA(lt_open)
  WHERE rbukrs = @lv_bukrs
    AND racct  = @lv_account
    AND ( augbl = @space ).   " open items`,
  },
  NATIVE_SQL_EXEC: {
    before: `* ISSUE: Native SQL is bound to the old schema and bypasses Open SQL
EXEC SQL.
  SELECT kunnr INTO :lv_kunnr FROM kna1 WHERE land1 = :lv_land
ENDEXEC.`,
    after: `* NOTE: portable Open SQL against the BP-backed projection
SELECT SINGLE kunnr
  FROM kna1
  WHERE land1 = @lv_land
  INTO @lv_kunnr.`,
  },
  CLASSIC_LIST_WRITE: {
    before: `* ISSUE: classical list output only renders in SAP GUI, not Fiori
WRITE: / 'Material', 20 'Quantity'.
LOOP AT lt_items INTO ls_item.
  WRITE: / ls_item-matnr, 20 ls_item-menge.
ENDLOOP.`,
    after: `* NOTE: interim ALV; strategic target is a CDS-based Fiori app / OData service
cl_salv_table=>factory(
  IMPORTING r_salv_table = DATA(lo_alv)
  CHANGING  t_table      = lt_items ).
lo_alv->display( ).`,
  },
};

const GENERIC: BeforeAfter = {
  before: `* ISSUE: pattern flagged by the S/4HANA rules engine — see snippet below
{{SNIPPET}}`,
  after: `* NOTE: apply the remediation described above, then re-run an ATC check
*       (transaction ATC / SE80) targeting the S/4HANA simplification database.`,
};

export function mockRemediation(args: {
  programName: string;
  findingTitle: string;
  simplificationItem: string;
  severity: string;
  ruleId: string;
  affectedCode: string;
  developerQuestion?: string;
}): string {
  const rule = getRule(args.ruleId);
  const lib = CODE_LIBRARY[args.ruleId] ?? {
    before: GENERIC.before.replace("{{SNIPPET}}", args.affectedCode || "* (no snippet captured)"),
    after: GENERIC.after,
  };

  const q = args.developerQuestion?.trim();
  const questionNote = q
    ? `\n\n> **Developer question:** ${q}\n>\n> Addressed inline in the steps below.`
    : "";

  return `### Problem Analysis
${rule?.root_cause ?? "This pattern is incompatible with the S/4HANA data/programming model."} ${rule?.business_impact ?? ""}${questionNote}

**Simplification item:** \`${args.simplificationItem}\` · **Severity:** ${args.severity}

### Before Code (ECC)
\`\`\`abap
${lib.before}
\`\`\`

### After Code (S/4HANA)
\`\`\`abap
${lib.after}
\`\`\`

### Step-by-Step Migration Instructions
1. Create a transport request and a feature branch (gCTS / abapGit) for the change to \`${args.programName}\`.
2. ${rule?.remediation ?? "Apply the corrected pattern shown above."}
3. Adjust dependent data declarations and any callers affected by the new field list / structure.
4. Run a static check via the ABAP Test Cockpit (transaction **ATC**) with the *S/4HANA readiness* check variant to confirm the finding clears.
5. Move the change through your standard transport landscape (DEV → QAS → PRD).

### Edge Cases & Warnings
- Watch for **implicit type conversions** when narrowing a \`SELECT *\` to an explicit field list — the target structure must match the projected columns.
- If other programs share the same internal table / structure, refactor them together to avoid runtime type mismatches.
- Compatibility views can mask data gaps: verify row counts before and after against a representative dataset.

### Verification
- Re-run the rules engine / **ATC** check — the finding for \`${args.simplificationItem}\` should no longer appear.
- Execute the program in SAP GUI (**SE38** / **SE80**) and compare output against an ECC baseline.
- For database-layer fixes, run **ST05** (SQL trace) to confirm the new access path performs as expected on HANA.

### Related Findings
Programs that hit this item frequently also trigger ${relatedHint(args.ruleId)}. Re-scan the full object set after remediation to catch cascading changes.`;
}

function relatedHint(ruleId: string): string {
  const map: Record<string, string> = {
    SELECT_STAR: "`SELECT_NO_ORDER_BY` (implicit sort) and `OBSOLETE_INTERNAL_TABLE` (header lines)",
    FI_ACDOCA_SECONDARY_INDEX: "`SD_KONV_PRCD_ELEMENTS` and other Universal-Journal data-model items",
    BP_CVI_MASTER: "`NATIVE_SQL_EXEC` against KNA1/LFA1 and customer/vendor BAPI usage",
    OBSOLETE_INTERNAL_TABLE: "`OBSOLETE_STATEMENTS` and `CLASSIC_LIST_WRITE`",
    CLASSIC_LIST_WRITE: "`SAPSCRIPT_SMARTFORMS` and other Fiori-readiness items",
  };
  return map[ruleId] ?? "other simplification items in the same category";
}

// ───────────────────────────────────────────────────────────────────────────
// Executive report narrative (mock).
// ───────────────────────────────────────────────────────────────────────────

export function mockReportNarrative(args: {
  customerName: string;
  totalPrograms: number;
  totalLoc: number;
  portfolioScore: number;
  counts: Record<Severity, number>;
  totalEffort: string;
  topFindings: { title: string; severity: Severity; program: string }[];
  topItems: { item: string; count: number }[];
  programNames: string[];
}): string {
  const { counts } = args;
  const blockers = counts.BLOCKER ?? 0;
  const highs = counts.HIGH ?? 0;
  const mediums = counts.MEDIUM ?? 0;

  const posture =
    args.portfolioScore >= 80
      ? "low-risk"
      : args.portfolioScore >= 60
        ? "moderate-risk"
        : args.portfolioScore >= 40
          ? "elevated-risk"
          : "high-risk";

  const themes = [...new Set(args.topFindings.map((f) => f.title))].slice(0, 3);

  return `### 1. Executive Overview
This report assesses the S/4HANA migration readiness of the custom ABAP landscape submitted by ${args.customerName}. Across ${args.totalPrograms} program${args.totalPrograms === 1 ? "" : "s"} totalling ${args.totalLoc.toLocaleString()} lines of code, the portfolio achieves an overall readiness score of ${args.portfolioScore} out of 100, placing it in a ${posture} posture for conversion. ${
    blockers > 0
      ? `Critically, ${blockers} blocking incompatibilit${blockers === 1 ? "y was" : "ies were"} identified that will prevent a clean conversion until remediated.`
      : "No hard blockers were identified, which means conversion can proceed in parallel with custom-code remediation."
  }

The dominant risk concentration is in the custom code's interaction with the simplified S/4HANA data model. Where programs read removed or restructured tables, or rely on platform behaviour that HANA no longer guarantees, the impact ranges from silent data errors to outright runtime failure. This assessment should be read alongside a functional impact analysis, as some technically valid code may still require process changes.

### 2. Key Findings
The findings cluster into a small number of recurring themes${themes.length ? `, most notably ${themes.join("; ")}` : ""}. Database-layer changes are the most material: direct access to removed FI and SD tables, and pricing/condition restructuring, account for the bulk of the high-severity findings. A second cluster concerns master data, where the mandatory Business Partner approach changes how customer and vendor data must be created and maintained. A third, lower-severity cluster covers obsolete ABAP syntax and SAP GUI-only output that, while not blocking, stands in the way of a clean-core, Fiori-first target state.

### 3. Migration Readiness Assessment
A score of ${args.portfolioScore}/100 indicates that the conversion is ${posture === "low-risk" ? "well within reach with focused effort" : posture === "moderate-risk" ? "achievable but contingent on disciplined remediation of the high-severity items" : "feasible only after a substantial remediation programme"}. With ${blockers} blocker${blockers === 1 ? "" : "s"}, ${highs} high and ${mediums} medium findings outstanding, the estimated total remediation effort is ${args.totalEffort}. In timeline terms this means the technical conversion should not be scheduled until at least the blocking findings have been cleared and regression-tested.

### 4. Recommended Next Steps
1. Resolve all BLOCKER findings first — prioritise ${blockerProgram(args.topFindings) ?? "the programs flagged with removed-table access"} — as these prevent a clean conversion.
2. Schedule the HIGH-severity database-layer fixes (removed FI/SD tables, KONV/PRCD_ELEMENTS) into the same remediation wave to avoid repeated regression cycles.
3. Run the ABAP Test Cockpit (ATC) with the S/4HANA readiness check variant across the full object set to confirm coverage beyond the sampled programs.
4. Address advisory findings (obsolete syntax, classical list output) opportunistically as part of the clean-core roadmap rather than blocking the conversion on them.
5. Re-scan after each remediation wave to confirm the readiness score trends toward the ≥ 80 target before cut-over.

### 5. Estimated Effort & Timeline
- **Phase 1 — Blockers (${blockers}):** target completion before the technical conversion is scheduled; estimated 1–3 weeks depending on data-model coupling.
- **Phase 2 — High severity (${highs}):** target completion within the conversion preparation window; estimated 2–4 weeks, runnable in parallel with Phase 1 testing.
- **Phase 3 — Medium / Low (${mediums} + advisory):** fold into the post-go-live clean-core backlog; estimated ongoing over the first 1–2 release cycles.

*Total indicative remediation effort: ${args.totalEffort}.*

_This narrative was generated in demo mode from the rules-engine results. Set an ANTHROPIC_API_KEY to regenerate it with live Claude analysis._`;
}

function blockerProgram(
  topFindings: { title: string; severity: Severity; program: string }[]
): string | null {
  const b = topFindings.find((f) => f.severity === "BLOCKER");
  return b ? `\`${b.program}\`` : null;
}

// ───────────────────────────────────────────────────────────────────────────
// Conversational Q&A (mock) — keyword routing over the scan context.
// ───────────────────────────────────────────────────────────────────────────

export function mockChat(args: {
  question: string;
  programNames: string[];
  score: number;
  findings: { title: string; severity: Severity; program: string; effort: string; lines: number[] }[];
  history: ChatMessage[];
  sapRelease: string;
  targetRelease: string;
}): string {
  const q = args.question.toLowerCase();
  const blockers = args.findings.filter((f) => f.severity === "BLOCKER");
  const highs = args.findings.filter((f) => f.severity === "HIGH");
  const followUp = "\n\nWould you like me to generate a remediation plan for any of these findings?";

  if (/\b(score|ready|readiness|how good|posture)\b/.test(q)) {
    const verdict = args.score >= 80 ? "in good shape" : args.score >= 60 ? "moderately ready" : "carrying significant risk";
    return `Your portfolio readiness score is **${args.score}/100**, which means it is ${verdict} for the move from ${args.sapRelease} to ${args.targetRelease}. The score is driven down primarily by ${blockers.length} blocker(s) and ${highs.length} high-severity finding(s). Clearing the blockers alone would lift the score materially, since they carry the heaviest penalty.${followUp}`;
  }

  if (/\b(blockers?|critical|worst|must[- ]?fix|mandatory|show ?stopper)/.test(q)) {
    if (blockers.length === 0)
      return `Good news — the scan found **no BLOCKER findings**. The highest-severity items are ${highs.length} HIGH finding(s), led by "${highs[0]?.title ?? "n/a"}". These should still be remediated before cut-over but do not prevent a clean conversion.${followUp}`;
    const list = blockers
      .slice(0, 5)
      .map((b) => `- **${b.title}** in \`${b.program}\` (lines ${b.lines.slice(0, 4).join(", ")})`)
      .join("\n");
    return `There ${blockers.length === 1 ? "is" : "are"} **${blockers.length} BLOCKER finding${blockers.length === 1 ? "" : "s"}** you must address before migrating:\n\n${list}\n\nThese are mandatory because they reference removed tables or the mandatory Business Partner model — the code will fail at runtime otherwise.${followUp}`;
  }

  if (/\b(effort|timeline|how long|duration|when|weeks?|days?)\b/.test(q)) {
    return `Based on the per-finding estimates, your remediation backlog runs across three phases: Phase 1 clears the ${blockers.length} blocker(s), Phase 2 the ${highs.length} high-severity item(s), and Phase 3 the advisory findings. As a rule of thumb, schedule the technical conversion only after Phase 1 is complete and regression-tested. For a precise plan, generate the executive report — it lays out indicative durations per phase.${followUp}`;
  }

  if (/\b(select\s*\*|performance|hana|select star)\b/.test(q)) {
    const f = args.findings.find((x) => /select \*/i.test(x.title));
    return `\`SELECT *\` matters on HANA because it stores data **column-wise** — reading every column defeats the optimisation of touching only what you need. ${f ? `In your scan it appears in \`${f.program}\` (lines ${f.lines.slice(0, 4).join(", ")}).` : ""} The fix is quick: replace the \`*\` with an explicit field list and a matching typed target, e.g.\n\n\`\`\`abap\nSELECT matnr, mtart, meins FROM mara\n  INTO TABLE @DATA(lt_mara)\n  WHERE mtart = @lv_mtart.\n\`\`\`${followUp}`;
  }

  if (/\b(business partner|bp|customer|vendor|kna1|lfa1|cvi)\b/.test(q)) {
    return `In S/4HANA the **Business Partner (BP)** is the single entry point for customer and vendor master data, and Customer/Vendor Integration (CVI) is mandatory. Any custom code that *creates or updates* customers/vendors via legacy tables (KNA1/LFA1) or classic BAPIs must be re-routed through BP APIs. Read-only access often still works via compatibility, but should be verified. Check SAP Launchpad for the relevant simplification-item notes.${followUp}`;
  }

  if (/\b(program|file|which|list|what did you scan)\b/.test(q)) {
    return `This session analysed ${args.programNames.length} program(s): ${args.programNames.map((p) => `\`${p}\``).join(", ")}. Collectively they produced ${args.findings.length} finding(s). Ask me about any one of them by name and I'll drill into its specific issues and remediation.${followUp}`;
  }

  // Fallback — general guidance.
  return `That's a good question. Based on your scan of ${args.programNames.length} program(s) (readiness ${args.score}/100), the priority order is: clear the ${blockers.length} blocker(s) first, then the ${highs.length} high-severity finding(s), then advisory cleanups. *This is general S/4HANA guidance combined with your scan results — for authoritative SAP Notes, check SAP Launchpad.*${followUp}`;
}
