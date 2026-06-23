import { NextResponse } from "next/server";
import { scanProgram, buildPortfolio } from "@/lib/engine";
import type { ProgramScan } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ScanRequest {
  files: { name: string; content: string }[];
  customer_name?: string;
  sap_release?: string;
  target_release?: string;
}

export async function POST(req: Request) {
  let body: ScanRequest;
  try {
    body = (await req.json()) as ScanRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const files = (body.files ?? []).filter((f) => f && typeof f.content === "string");
  if (files.length === 0) {
    return NextResponse.json({ error: "No ABAP files provided" }, { status: 400 });
  }
  if (files.length > 50) {
    return NextResponse.json({ error: "Maximum 50 files per scan" }, { status: 400 });
  }

  try {
    const programs: ProgramScan[] = [];
    for (const f of files) {
      // Cap individual file size to keep prompts sane.
      const content = f.content.slice(0, 60000);
      programs.push(await scanProgram(f.name || "ZPROGRAM", content));
    }

    const portfolio = buildPortfolio(programs, {
      customer_name: body.customer_name?.trim() || "Demo Customer",
      sap_release: body.sap_release?.trim() || "ECC 6.0 EhP8",
      target_release: body.target_release?.trim() || "S/4HANA 2023",
    });

    return NextResponse.json(portfolio);
  } catch (err) {
    console.error("[/api/scan] error:", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
