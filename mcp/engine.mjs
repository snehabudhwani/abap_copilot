// Compact, dependency-light scan engine for the MCP server.
// Mirrors the Next.js app's rules engine (src/lib/rulesEngine.ts + abap.ts)
// but reads the same YAML catalog so rules stay in a single source of truth.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_DIR = path.join(__dirname, "..", "src", "rules");

let cachedRules = null;

export function loadRules() {
  if (cachedRules) return cachedRules;
  const files = fs
    .readdirSync(RULES_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  const rules = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(RULES_DIR, file), "utf-8");
    const parsed = parseYaml(raw);
    if (Array.isArray(parsed)) rules.push(...parsed);
  }
  cachedRules = rules;
  return rules;
}

function stripComment(line) {
  const trimmed = line.replace(/^﻿/, "");
  if (/^\s*\*/.test(trimmed)) return "";
  const idx = trimmed.indexOf('"');
  return idx >= 0 ? trimmed.slice(0, idx) : trimmed;
}

const SEVERITY_PENALTY = { BLOCKER: 22, HIGH: 12, MEDIUM: 6, LOW: 2, INFO: 0 };
const SEVERITY_ORDER = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "INFO"];

export function scanSource(source, filename = "ZPROGRAM") {
  const rules = loadRules();
  const rawLines = source.split(/\r?\n/);
  const cleanLines = rawLines.map(stripComment);
  const findings = [];

  for (const rule of rules) {
    const compiled = (rule.patterns || [])
      .map((p) => {
        try {
          return new RegExp(p, "i");
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const matchedLines = [];
    const snippets = [];
    for (let i = 0; i < cleanLines.length; i++) {
      const clean = cleanLines[i];
      if (!clean.trim()) continue;
      if (compiled.some((re) => re.test(clean))) {
        matchedLines.push(i + 1);
        if (snippets.length < 6) snippets.push({ line: i + 1, text: rawLines[i].trimEnd() });
      }
    }
    if (matchedLines.length > 0) {
      findings.push({
        rule_id: rule.id,
        simplification_item: rule.simplification_item,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        effort: rule.effort,
        affected_lines: matchedLines,
        root_cause: rule.root_cause,
        business_impact: rule.business_impact,
        remediation: rule.remediation,
        sap_note: rule.sap_note,
        snippets,
      });
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      b.affected_lines.length - a.affected_lines.length
  );

  let penalty = 0;
  for (const f of findings) penalty += SEVERITY_PENALTY[f.severity] ?? 0;
  const readiness_score = findings.length === 0 ? 100 : Math.max(5, Math.min(100, 100 - penalty));

  const counts = { BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) counts[f.severity]++;

  const loc = rawLines.filter((l) => l.trim() && !/^\s*\*/.test(l)).length;

  return {
    program_name: filename.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 60) || "ZPROGRAM",
    loc,
    readiness_score,
    counts,
    findings,
  };
}

export function ruleCatalog() {
  return loadRules().map((r) => ({
    id: r.id,
    simplification_item: r.simplification_item,
    title: r.title,
    category: r.category,
    severity: r.severity,
    effort: r.effort,
  }));
}
