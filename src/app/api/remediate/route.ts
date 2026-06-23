import { NextResponse } from "next/server";
import { remediate } from "@/lib/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RemediateRequest {
  programName: string;
  findingTitle: string;
  simplificationItem: string;
  severity: string;
  ruleId: string;
  affectedCode: string;
  developerQuestion?: string;
}

export async function POST(req: Request) {
  let body: RemediateRequest;
  try {
    body = (await req.json()) as RemediateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.findingTitle || !body.ruleId) {
    return NextResponse.json({ error: "Missing finding context" }, { status: 400 });
  }

  try {
    const markdown = await remediate({
      programName: body.programName || "ZPROGRAM",
      findingTitle: body.findingTitle,
      simplificationItem: body.simplificationItem || "Verify in SAP Launchpad",
      severity: body.severity || "MEDIUM",
      ruleId: body.ruleId,
      affectedCode: body.affectedCode || "",
      developerQuestion: body.developerQuestion,
    });
    return NextResponse.json({ markdown });
  } catch (err) {
    console.error("[/api/remediate] error:", err);
    return NextResponse.json({ error: "Remediation failed" }, { status: 500 });
  }
}
