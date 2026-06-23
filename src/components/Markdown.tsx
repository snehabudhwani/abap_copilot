"use client";

import React from "react";

// ── Minimal, dependency-free markdown renderer ──
// Supports: ### / #### headings, fenced code blocks, - / * bullets,
// numbered lists, > blockquotes, **bold**, *italic*, `inline code`.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on bold, italic, and inline code while preserving delimiters.
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function highlightAbap(line: string): React.ReactNode {
  // Color * ISSUE / * NOTE comment-style annotations and additions.
  if (/^\s*\*\s*ISSUE/i.test(line)) return <span className="del">{line}</span>;
  if (/^\s*\*\s*NOTE/i.test(line)) return <span className="add">{line}</span>;
  if (/^\s*\*/.test(line)) return <span className="cmt">{line}</span>;
  return line;
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];

  let i = 0;
  let key = 0;
  let listBuffer: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!listBuffer) return;
    const items = listBuffer.items.map((it, idx) => (
      <li key={idx}>{renderInline(it, `li-${key}-${idx}`)}</li>
    ));
    blocks.push(
      listBuffer.ordered ? (
        <ol key={`ol-${key++}`}>{items}</ol>
      ) : (
        <ul key={`ul-${key++}`}>{items}</ul>
      )
    );
    listBuffer = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      flushList();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre key={`code-${key++}`} className="code">
          {code.map((c, idx) => (
            <div key={idx}>{highlightAbap(c)}</div>
          ))}
        </pre>
      );
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      i++;
      continue;
    }

    if (/^####\s+/.test(trimmed)) {
      flushList();
      blocks.push(<h4 key={`h4-${key++}`}>{renderInline(trimmed.replace(/^####\s+/, ""), `h4-${key}`)}</h4>);
      i++;
      continue;
    }
    if (/^###\s+/.test(trimmed)) {
      flushList();
      blocks.push(<h3 key={`h3-${key++}`}>{renderInline(trimmed.replace(/^###\s+/, ""), `h3-${key}`)}</h3>);
      i++;
      continue;
    }
    if (/^##\s+/.test(trimmed)) {
      flushList();
      blocks.push(<h3 key={`h2-${key++}`}>{renderInline(trimmed.replace(/^##\s+/, ""), `h2-${key}`)}</h3>);
      i++;
      continue;
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (ordered) {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(ordered[2]);
      i++;
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.*)/);
    if (bullet) {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(bullet[1]);
      i++;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushList();
      blocks.push(
        <p key={`q-${key++}`} style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 12, color: "var(--muted)", fontStyle: "italic" }}>
          {renderInline(trimmed.replace(/^>\s?/, ""), `q-${key}`)}
        </p>
      );
      i++;
      continue;
    }

    flushList();
    blocks.push(<p key={`p-${key++}`}>{renderInline(trimmed, `p-${key}`)}</p>);
    i++;
  }
  flushList();

  return <div className="prose">{blocks}</div>;
}
