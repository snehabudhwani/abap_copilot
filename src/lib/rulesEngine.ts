import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Rule, RuleMatch } from "./types";

// ── Rule loading (cached) ──
let cachedRules: Rule[] | null = null;

function rulesDir(): string {
  return path.join(process.cwd(), "src", "rules");
}

/** Load and cache every YAML rule file in src/rules. */
export function loadRules(): Rule[] {
  if (cachedRules) return cachedRules;

  const dir = rulesDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  const rules: Rule[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const parsed = parseYaml(raw) as Rule[] | null;
    if (Array.isArray(parsed)) rules.push(...parsed);
  }
  cachedRules = rules;
  return rules;
}

/** Reset cache — used by tests / hot reload. */
export function clearRuleCache(): void {
  cachedRules = null;
}

// ── ABAP source preprocessing ──

/**
 * Strip full-line and inline ABAP comments so patterns don't match commented
 * code. ABAP comments: a line starting with `*`, or text after `"`.
 * Returns the cleaned line but preserves length/positions loosely (we only
 * need it for matching, not for display).
 */
function stripComment(line: string): string {
  const trimmed = line.replace(/^﻿/, "");
  if (/^\s*\*/.test(trimmed)) return ""; // full-line comment
  // inline comment: first unquoted double-quote starts a comment.
  // (ABAP string literals use single quotes, so " is unambiguous as comment.)
  const idx = trimmed.indexOf('"');
  return idx >= 0 ? trimmed.slice(0, idx) : trimmed;
}

// ── Scanning ──

export interface ScanOptions {
  /** Max snippet lines captured per rule (default 6). */
  maxSnippets?: number;
}

/**
 * Run every rule against the ABAP source and return matches.
 * ABAP is case-insensitive, so all patterns are matched with the `i` flag.
 */
export function scanSource(source: string, opts: ScanOptions = {}): RuleMatch[] {
  const maxSnippets = opts.maxSnippets ?? 6;
  const rules = loadRules();
  const rawLines = source.split(/\r?\n/);
  const cleanLines = rawLines.map(stripComment);

  const matches: RuleMatch[] = [];

  for (const rule of rules) {
    const compiled = rule.patterns.map((p) => {
      try {
        return new RegExp(p, "i");
      } catch {
        return null;
      }
    });

    const matchedLines: number[] = [];
    const snippets: { line: number; text: string }[] = [];

    for (let i = 0; i < cleanLines.length; i++) {
      const clean = cleanLines[i];
      if (!clean.trim()) continue;
      const hit = compiled.some((re) => re !== null && re.test(clean));
      if (hit) {
        const lineNo = i + 1;
        matchedLines.push(lineNo);
        if (snippets.length < maxSnippets) {
          snippets.push({ line: lineNo, text: rawLines[i].trimEnd() });
        }
      }
    }

    if (matchedLines.length > 0) {
      matches.push({
        rule_id: rule.id,
        simplification_item: rule.simplification_item,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        effort: rule.effort,
        matched_lines: matchedLines,
        snippets,
      });
    }
  }

  return matches;
}

/** Look up a single rule by id. */
export function getRule(id: string): Rule | undefined {
  return loadRules().find((r) => r.id === id);
}

/** Convenience: total number of loaded rules (for the UI badge). */
export function ruleCount(): number {
  return loadRules().length;
}
