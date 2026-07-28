import { NextResponse } from "next/server";

import { listGraphTopology } from "@/lib/falkor";

/**
 * GET /api/graph — read-only Memory + Links topology for `/graph`.
 *
 * - No embeddings in the payload.
 * - Never calls setMemoryLayout (client must not write layout via this route).
 * - Empty DB → `{ ok: true, empty: true, memories: [], links: [] }`.
 *
 * Canvas: default `/graph` attempts this feed (non-empty → live; empty/error →
 * mock). Overrides: `?source=live` (empty stays empty), `?source=mock`.
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const { memories, links } = await listGraphTopology();
    return NextResponse.json({
      ok: true,
      source: "falkor",
      empty: memories.length === 0,
      memories,
      links,
    });
  } catch (error) {
    console.error("GET /api/graph:", error);
    return NextResponse.json(
      {
        ok: false,
        source: "falkor",
        empty: true,
        memories: [],
        links: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
