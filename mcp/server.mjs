#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// ABAP Modernization Copilot — MCP server
// Exposes the S/4HANA scan engine as Model Context Protocol tools so any MCP
// client (e.g. Claude Desktop) can scan ABAP and browse the rule catalog.
// Transport: stdio.
// ───────────────────────────────────────────────────────────────────────────

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { scanSource, ruleCatalog, loadRules } from "./engine.mjs";

const server = new Server(
  { name: "abap-copilot", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "scan_abap",
    description:
      "Scan ABAP source code for SAP S/4HANA migration incompatibilities. " +
      "Pattern-matches the code against the simplification-item rule catalog and " +
      "returns findings (with severity, affected line numbers, root cause and " +
      "remediation), a 0–100 readiness score, and a severity breakdown.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "Raw ABAP source code to analyze." },
        filename: {
          type: "string",
          description: "Optional program name / filename (used for the program label).",
        },
      },
      required: ["source"],
    },
  },
  {
    name: "list_simplification_rules",
    description:
      "List the S/4HANA simplification-item rules the scanner checks for " +
      "(id, reference, title, category, severity, effort).",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional filter — only return rules in this category.",
        },
        severity: {
          type: "string",
          enum: ["BLOCKER", "HIGH", "MEDIUM", "LOW", "INFO"],
          description: "Optional filter — only return rules of this severity.",
        },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    if (name === "scan_abap") {
      if (!args.source || typeof args.source !== "string") {
        return errorResult("`source` (ABAP code string) is required.");
      }
      const result = scanSource(args.source.slice(0, 60000), args.filename || "ZPROGRAM");
      const summary =
        `${result.program_name}: ${result.findings.length} finding(s), ` +
        `readiness ${result.readiness_score}/100 ` +
        `(BLOCKER ${result.counts.BLOCKER}, HIGH ${result.counts.HIGH}, ` +
        `MEDIUM ${result.counts.MEDIUM}, LOW ${result.counts.LOW}).`;
      return jsonResult({ summary, ...result });
    }

    if (name === "list_simplification_rules") {
      let rules = ruleCatalog();
      if (args.category) {
        const c = String(args.category).toLowerCase();
        rules = rules.filter((r) => r.category.toLowerCase().includes(c));
      }
      if (args.severity) {
        rules = rules.filter((r) => r.severity === args.severity);
      }
      return jsonResult({ count: rules.length, rules });
    }

    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult(`Tool execution failed: ${err?.message || String(err)}`);
  }
});

function jsonResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}
function errorResult(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function main() {
  // Warm the rule cache so the first tool call is fast (and fails early if the
  // catalog is missing).
  loadRules();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Note: do not write to stdout — it is the MCP transport. Use stderr for logs.
  console.error("[abap-copilot-mcp] ready — tools: scan_abap, list_simplification_rules");
}

main().catch((err) => {
  console.error("[abap-copilot-mcp] fatal:", err);
  process.exit(1);
});
