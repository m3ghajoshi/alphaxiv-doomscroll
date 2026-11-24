import { NextResponse, type NextRequest } from "next/server";
import { getFeedPage } from "@/lib/alphaxiv/feed";
import { UpstreamError } from "@/lib/alphaxiv/http";

export const dynamic = "force-dynamic";

function parseIntParam(value: string | null, fallback: number, min: number, max: number) {
  if (value === null || value.trim() === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

/** GET /api/feed?cursor=0&limit=5 — one page of Hot papers that have a video explainer. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cursor = parseIntParam(searchParams.get("cursor"), 0, 0, 10_000);
  const limit = parseIntParam(searchParams.get("limit"), 5, 1, 20);
  if (cursor === null || limit === null) {
    return NextResponse.json(
      { error: "cursor must be an integer 0-10000 and limit an integer 1-20" },
      { status: 400 },
    );
  }

  try {
    const page = await getFeedPage(cursor, limit);
    return NextResponse.json(page, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[api/feed] ${message}`);
    const status = error instanceof UpstreamError ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
