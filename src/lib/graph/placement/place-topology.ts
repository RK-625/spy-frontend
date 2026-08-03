/**
 * placeTopology — product placement entry (hit/miss owned here).
 *
 * - Hit: assemble from cached `{x,y}` + deriveRanks ranks.
 * - Miss: assemble at (0,0) → settleGraphData (pure) → save `{x,y}` → return.
 *
 * Side effects: localStorage load/save only. No Pixi, React, Falkor, or layout-loop.
 * Miss starts at origin — no seed positions.
 */

import {
  emptyNodeIncidence,
  recomputeIncidence,
  type GraphData,
  type GraphEdge,
  type GraphNode,
} from "../core/graph-data";
import type { Links, MemoryNode } from "@/types/graph-schema";
import { settleGraphData } from "./force-recipe";
import {
  computeTopoFingerprint,
  deriveRanks,
  loadPlacementCache,
  savePlacementCache,
  type CachedPlacementNode,
} from "./placement-cache";

function linksToEdges(links: ReadonlyArray<Links>): GraphEdge[] {
  return links.map((link) => ({
    id: `${link.type}:${link.source}->${link.target}`,
    source: link.source,
    target: link.target,
    type: link.type,
  }));
}

function assembleNodes(
  memories: ReadonlyArray<MemoryNode>,
  ranks: Map<string, number>,
  poses: Record<string, CachedPlacementNode> | null
): GraphNode[] {
  return memories.map((memory) => {
    const cached = poses?.[memory.id];
    return {
      id: memory.id,
      label: memory.name,
      content: memory.content,
      impression: memory.impression,
      confidence: memory.confidence,
      x: cached?.x ?? 0,
      y: cached?.y ?? 0,
      rank: ranks.get(memory.id) ?? 0,
      ...emptyNodeIncidence(),
    };
  });
}

/**
 * Map topology (MemoryNode[] + Links[]) → placed GraphData.
 * Owns fingerprint hit/miss; settles and caches on miss only.
 */
export function placeTopology(input: {
  memories: MemoryNode[];
  links: Links[];
}): GraphData {
  const edges = linksToEdges(input.links);
  const ranks = deriveRanks(input.memories, edges);
  const fingerprint = computeTopoFingerprint(input.memories, edges, ranks);
  const cache = loadPlacementCache(fingerprint);

  if (cache != null) {
    // Hit: paint cached poses; ranks always from deriveRanks.
    const graph: GraphData = {
      nodes: assembleNodes(input.memories, ranks, cache),
      edges,
    };
    recomputeIncidence(graph);
    return graph;
  } else {
    // Miss: origin → pure settle → save {x,y} only.
    const cold: GraphData = {
      nodes: assembleNodes(input.memories, ranks, null),
      edges,
    };
    recomputeIncidence(cold);
    const settled = settleGraphData(cold);

    const cachedNodes: Record<string, CachedPlacementNode> = {};
    for (const node of settled.nodes) {
      cachedNodes[node.id] = { x: node.x, y: node.y };
    }
    savePlacementCache(fingerprint, cachedNodes);
    return settled;
  }
}
