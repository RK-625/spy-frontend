/**
 * Hierarchy rank derivation from PART_OF edges.
 *
 * Rank is a derived field on GraphNode (not long-lived Maps). Edges remain
 * canonical: re-run assignRanks whenever topology is installed.
 *
 * PART_OF direction: source = child, target = parent ("child is PART_OF parent").
 * RELATES_TO never sets parent or rank.
 */

import type { GraphData, GraphNode } from "./graph-data";

/**
 * Pure: clones nodes/edges and returns a new GraphData with `rank` filled.
 *
 * Rules:
 * - Parent links from PART_OF only (source → parent = target)
 * - At most one parent per node; multi-parent → warn, keep first
 * - Roots / nodes with no PART_OF parent → rank 0
 * - Child rank = parent.rank + 1
 * - Cycles → warn, break by treating the re-visited node as rank 0 for that path
 */
export function assignRanks(graphData: GraphData): GraphData {
  const nodes = graphData.nodes.map((n) => ({ ...n }));
  const edges = graphData.edges.map((e) => ({ ...e }));
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Temporary parent map — not exported / not app state
  const parentOf = new Map<string, string>();

  for (const edge of edges) {
    if (edge.type !== "PART_OF") continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;

    const existing = parentOf.get(edge.source);
    if (existing !== undefined) {
      console.warn(
        `[assignRanks] multi-parent for node "${edge.source}": keeping "${existing}", ignoring "${edge.target}"`
      );
      continue;
    }
    parentOf.set(edge.source, edge.target);
  }

  const rankById = new Map<string, number>();

  function rankOf(id: string, visiting: Set<string>): number {
    const cached = rankById.get(id);
    if (cached !== undefined) return cached;

    if (visiting.has(id)) {
      console.warn(
        `[assignRanks] PART_OF cycle involving "${id}"; treating as rank 0`
      );
      rankById.set(id, 0);
      return 0;
    }

    const parentId = parentOf.get(id);
    if (parentId === undefined || !nodeIds.has(parentId)) {
      rankById.set(id, 0);
      return 0;
    }

    visiting.add(id);
    const rank = rankOf(parentId, visiting) + 1;
    visiting.delete(id);
    rankById.set(id, rank);
    return rank;
  }

  const rankedNodes: GraphNode[] = nodes.map((n) => ({
    ...n,
    rank: rankOf(n.id, new Set()),
  }));

  return { nodes: rankedNodes, edges };
}
