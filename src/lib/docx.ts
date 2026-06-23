// Word (.docx) executive report generator using the `docx` package.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} from "docx";
import type { PortfolioScan, Severity, Finding } from "./types";

const NAVY = "0B1F3A";
const ACCENT = "0079B8";
const GREY = "64748B";

const SEV_COLOR: Record<Severity, string> = {
  BLOCKER: "C0233A",
  HIGH: "C75119",
  MEDIUM: "B7860B",
  LOW: "0079B8",
  INFO: "64748B",
};

function cell(text: string, opts: { bold?: boolean; color?: string; shade?: string; width?: number } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shade
      ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shade }
      : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold: opts.bold, color: opts.color, size: 18 }),
        ],
      }),
    ],
  });
}

function headerRow(labels: string[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l) => cell(l, { bold: true, color: "FFFFFF", shade: NAVY })),
  });
}

function statsTable(p: PortfolioScan): Table {
  const rows = [
    headerRow(["Metric", "Value"]),
    ...[
      ["Customer", p.customer_name],
      ["Programs scanned", String(p.programs.length)],
      ["Total lines of code", p.total_loc.toLocaleString()],
      ["Source release", p.sap_release],
      ["Target release", p.target_release],
      ["Portfolio readiness score", `${p.portfolio_score} / 100`],
      ["Estimated remediation effort", p.total_effort],
      ["Analysis engine", p.engine === "claude" ? `Claude (${p.model})` : "Demo mode (rules engine)"],
    ].map(
      ([k, v]) =>
        new TableRow({ children: [cell(k, { bold: true, width: 40 }), cell(v, { width: 60 })] })
    ),
  ];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function severityTable(p: PortfolioScan): Table {
  const order: Severity[] = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "INFO"];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(["Severity", "Count"]),
      ...order.map(
        (sev) =>
          new TableRow({
            children: [
              cell(sev, { bold: true, color: SEV_COLOR[sev], width: 50 }),
              cell(String(p.counts[sev] ?? 0), { width: 50 }),
            ],
          })
      ),
    ],
  });
}

function findingsTable(findings: Finding[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(["Severity", "Finding", "Item", "Lines", "Effort"]),
      ...findings.map(
        (f) =>
          new TableRow({
            children: [
              cell(f.severity, { bold: true, color: SEV_COLOR[f.severity], width: 12 }),
              cell(f.title, { width: 40 }),
              cell(f.simplification_item, { width: 24, color: GREY }),
              cell(f.affected_lines.slice(0, 6).join(", "), { width: 14, color: GREY }),
              cell(f.effort, { width: 10, color: GREY }),
            ],
          })
      ),
    ],
  });
}

function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ heading: level, children: [new TextRun({ text })], spacing: { before: 240, after: 120 } });
}

function para(text: string, opts: { color?: string; italic?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, color: opts.color, italics: opts.italic, size: opts.size ?? 20 })],
  });
}

/** Convert the markdown-ish narrative into Word paragraphs. */
function narrativeParagraphs(md: string): Paragraph[] {
  const out: Paragraph[] = [];
  const lines = md.split(/\r?\n/);
  let inCode = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(
        new Paragraph({
          children: [new TextRun({ text: line, font: "Consolas", size: 18, color: "334155" })],
        })
      );
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^####\s+/.test(trimmed)) {
      out.push(h(trimmed.replace(/^####\s+/, ""), HeadingLevel.HEADING_3));
    } else if (/^###\s+/.test(trimmed)) {
      out.push(h(trimmed.replace(/^###\s+/, ""), HeadingLevel.HEADING_2));
    } else if (/^(\d+)\.\s+/.test(trimmed)) {
      out.push(
        new Paragraph({
          numbering: { reference: "report-numbers", level: 0 },
          children: [new TextRun({ text: stripMd(trimmed.replace(/^\d+\.\s+/, "")), size: 20 })],
        })
      );
    } else if (/^[-*]\s+/.test(trimmed)) {
      out.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: stripMd(trimmed.replace(/^[-*]\s+/, "")), size: 20 })],
        })
      );
    } else if (/^>/.test(trimmed)) {
      out.push(para(stripMd(trimmed.replace(/^>\s?/, "")), { italic: true, color: GREY }));
    } else {
      out.push(para(stripMd(trimmed)));
    }
  }
  return out;
}

function stripMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/_(.+?)_/g, "$1");
}

export async function buildReportDocx(
  portfolio: PortfolioScan,
  narrative: string
): Promise<Buffer> {
  const date = new Date(portfolio.scanned_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const programSections: Paragraph[] = [];
  const programTables: (Paragraph | Table)[] = [];
  for (const prog of portfolio.programs) {
    programTables.push(
      h(`${prog.program_name}  ·  ${prog.readiness_score}/100`, HeadingLevel.HEADING_2),
      para(`${prog.program_type} · ${prog.loc} LOC · ${prog.findings.length} finding(s)`, {
        color: GREY,
        size: 18,
      }),
      para(prog.summary)
    );
    if (prog.findings.length > 0) {
      programTables.push(findingsTable(prog.findings), para(""));
    }
  }

  const doc = new Document({
    creator: "ABAP Modernization Copilot",
    title: `S/4HANA Migration Readiness Report — ${portfolio.customer_name}`,
    description: "AI-augmented S/4HANA migration readiness analysis",
    numbering: {
      config: [
        {
          reference: "report-numbers",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20 } },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          // ── Title block ──
          new Paragraph({
            spacing: { before: 1200, after: 0 },
            children: [
              new TextRun({ text: "S/4HANA MIGRATION", bold: true, size: 56, color: NAVY }),
            ],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({ text: "READINESS REPORT", bold: true, size: 56, color: ACCENT }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: portfolio.customer_name, size: 32, color: "334155" })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Custom ABAP Code Impact Assessment  ·  ${date}`,
                size: 20,
                color: GREY,
              }),
            ],
            spacing: { after: 600 },
          }),

          h("Assessment Summary", HeadingLevel.HEADING_1),
          statsTable(portfolio),
          para(""),
          h("Findings by Severity", HeadingLevel.HEADING_2),
          severityTable(portfolio),
          para(""),

          h("Executive Summary", HeadingLevel.HEADING_1),
          ...narrativeParagraphs(narrative),

          h("Program-Level Detail", HeadingLevel.HEADING_1),
          ...programTables,

          new Paragraph({
            spacing: { before: 480 },
            children: [
              new TextRun({
                text:
                  portfolio.engine === "claude"
                    ? `Generated by ABAP Modernization Copilot with Claude (${portfolio.model}).`
                    : "Generated by ABAP Modernization Copilot in demo mode (rules engine). Configure an Anthropic API key for live Claude analysis.",
                italics: true,
                size: 16,
                color: GREY,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
