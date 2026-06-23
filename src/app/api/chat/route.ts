import { NextResponse } from "next/server";
import { chatAnswer } from "@/lib/engine";
import type { ChatMessage, Severity } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  question: string;
  history?: ChatMessage[];
  programNames?: string[];
  score?: number;
  findings?: { title: string; severity: Severity; program: string; effort: string; lines: number[] }[];
  sapRelease?: string;
  targetRelease?: string;
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.question?.trim()) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }

  try {
    const answer = await chatAnswer({
      question: body.question.trim(),
      history: body.history ?? [],
      programNames: body.programNames ?? [],
      score: body.score ?? 100,
      findings: body.findings ?? [],
      sapRelease: body.sapRelease ?? "ECC 6.0",
      targetRelease: body.targetRelease ?? "S/4HANA 2023",
    });
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
