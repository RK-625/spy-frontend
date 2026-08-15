import { NextResponse } from "next/server";

import { listGraphTopology } from "@/lib/falkor";
import type { GraphApiResponse } from "@/types/graph-topology";

/**
 * GET /api/sigma — live topology feed for the Sigma canvas host (`/sigma`).
 *
 * - No embeddings in the payload.
 * - Topology only (no x/y/rank). This route never reads/writes poses.
 * - Wire SoT: `GraphApiResponse` / `GraphTopology` in `@/types/graph-topology`
 *   (`MemoryNode[]` + `links[]`, not GraphNode). Client Sigma host maps
 *   memories/links to simulation nodes/links.
 * - Empty DB → `{ ok: true, empty: true, memories: [], links: [] }`.
 *
 * Product canvas (`/sigma`, live-only): always fetches this route on mount.
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
    console.error("GET /api/sigma:", error);
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
