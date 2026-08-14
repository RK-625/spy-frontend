import { NextResponse } from "next/server";

import { listGraphTopology } from "@/lib/falkor";
import type { GraphApiResponse } from "@/types/graph-topology";

/**
 * GET /api/graph — read-only Memory + Links topology for `/graph`.
 *
 * - No embeddings in the payload.
 * - Topology only (no x/y/rank). This route never reads/writes poses.
 * - Wire SoT: `GraphApiResponse` / `GraphTopology` in `@/types/graph-topology`
 *   (`MemoryNode[]` + `links[]`, not GraphNode). Client Cosmograph maps
 *   memories/links to points/links.
 * - Empty DB → `{ ok: true, empty: true, memories: [], links: [] }`.
 *
 * Product canvas (`/graph`, live-only): always fetches this route on mount.
 * Empty KB / error → blank canvas (no mock).
 * No product URL flags for source/mock/stress/layout/motion.
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const { memories, links } = await listGraphTopology();
    const body: GraphApiResponse = {
      ok: true,
      source: "falkor",
      empty: memories.length === 0,
      memories,
      links,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/graph:", error);
    const body: GraphApiResponse = {
      ok: false,
      source: "falkor",
      empty: true,
      memories: [],
      links: [],
      error: error instanceof Error ? error.message : String(error),
    };
    return NextResponse.json(body, { status: 500 });
  }
}
