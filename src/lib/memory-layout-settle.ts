/**
 * Server-side P-A layout settle + persist (Slice 5).
 *
 * Shared pure recipe (`settleGraphData`) places the topology; settled world
 * `x` / `y` and topology-derived `rank` are written via `setMemoryLayout`.
 * Call only when topology/placement must change (create, link, missing xy).
 * Content-only upserts must not call this (no reshuffle).
 *
 * Persist policy **P-A** (locked): durable settled coords for stable reopen.
 * Client `/graph` never writes layout.
 */

import { listGraphTopology, setMemoryLayout } from "@/lib/falkor";
import { memoryGraphToGraphDataWithMeta } from "@/lib/graph/from-memory-graph";
import { settleGraphData } from "@/lib/graph/force-recipe";

export type SettleAndPersistOptions = {
  /**
   * Rank overrides applied on the in-memory GraphData before settle
   * (e.g. PART_OF child = parent.rank + 1). Force never invents rank.
   */
  rankOverrides?: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
};

function rankOverrideFor(
  id: string,
  overrides: SettleAndPersistOptions["rankOverrides"],
): number | undefined {
  if (overrides == null) return undefined;
  if (overrides instanceof Map) {
    const v = overrides.get(id);
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  }
  const v = overrides[id];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Load full topology → apply rank overrides → one-shot settle → persist all nodes.
 * Returns the number of layouts written.
 */
export async function settleAndPersistMemoryLayouts(
  options?: SettleAndPersistOptions,
): Promise<{ written: number }> {
  const { memories, links } = await listGraphTopology();
  const { graph } = memoryGraphToGraphDataWithMeta({ memories, links });

  for (const node of graph.nodes) {
    const override = rankOverrideFor(node.id, options?.rankOverrides);
    if (override !== undefined) {
      node.rank = Math.max(0, Math.floor(override));
    }
  }

  const settled = settleGraphData(graph);

  let written = 0;
  for (const node of settled.nodes) {
    await setMemoryLayout({
      id: node.id,
      x: node.x,
      y: node.y,
      rank: node.rank,
    });
    written += 1;
  }

  return { written };
}
