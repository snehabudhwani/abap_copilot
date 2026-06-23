import { reportNarrative } from "@/lib/engine";
import { buildReportDocx } from "@/lib/docx";
import type { PortfolioScan } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let portfolio: PortfolioScan;
  try {
    portfolio = (await req.json()) as PortfolioScan;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!portfolio?.programs) {
    return Response.json({ error: "Missing portfolio data" }, { status: 400 });
  }

  const preview = new URL(req.url).searchParams.get("preview") === "1";

  try {
    const narrative = await reportNarrative(portfolio);

    // Preview mode: return the narrative markdown for in-app rendering.
    if (preview) {
      return Response.json({ narrative });
    }

    const buffer = await buildReportDocx(portfolio, narrative);

    const safeName = (portfolio.customer_name || "report")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
    const filename = `s4hana_readiness_${safeName || "report"}.docx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[/api/report] error:", err);
    return Response.json({ error: "Report generation failed" }, { status: 500 });
  }
}
