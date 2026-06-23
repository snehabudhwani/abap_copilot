import { NextResponse } from "next/server";
import { isLive, activeModel } from "@/lib/claude";
import { ruleCount } from "@/lib/rulesEngine";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    live: isLive(),
    model: isLive() ? activeModel() : null,
    rules: ruleCount(),
  });
}
