// Smoke test: spawn the MCP server over stdio, list tools, and run a scan.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SAMPLE = `REPORT zfi_open_items.
SELECT * FROM bsis INTO TABLE @DATA(lt) WHERE bukrs = '1000'.
EXEC SQL.
  SELECT kunnr INTO :lv FROM kna1
ENDEXEC.
WRITE: / 'done'.`;

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(__dirname, "server.mjs")],
});

const client = new Client({ name: "smoke", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const rules = await client.callTool({ name: "list_simplification_rules", arguments: { severity: "BLOCKER" } });
console.log("BLOCKER rules:", JSON.parse(rules.content[0].text).count);

const scan = await client.callTool({ name: "scan_abap", arguments: { source: SAMPLE, filename: "ZFI_OPEN_ITEMS.abap" } });
const parsed = JSON.parse(scan.content[0].text);
console.log("SCAN summary:", parsed.summary);
console.log("findings:", parsed.findings.map((f) => `${f.severity}:${f.rule_id}@${f.affected_lines.join(",")}`).join(" | "));

await client.close();
console.log("SMOKE OK");
process.exit(0);
