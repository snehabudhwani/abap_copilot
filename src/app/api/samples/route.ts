import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

/** Serve the bundled synthetic ABAP samples so the demo works one-click. */
export async function GET() {
  try {
    const dir = path.join(process.cwd(), "samples");
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".abap") || f.endsWith(".txt"))
      .sort();

    const payload = files.map((name) => ({
      name,
      content: fs.readFileSync(path.join(dir, name), "utf-8"),
    }));

    return NextResponse.json({ files: payload });
  } catch (err) {
    console.error("[/api/samples] error:", err);
    return NextResponse.json({ files: [] });
  }
}
