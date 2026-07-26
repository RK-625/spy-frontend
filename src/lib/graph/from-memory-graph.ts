/**
 * Pure Memory[] + Links[] → GraphData adapter (no Falkor, Pixi, React, or fetch).
 *
 * Uses product types `Memory` / `Links` from `@/types/graph-schema`.
 * Maps to canvas GraphData only — does **not** recompute layout or rank.
 *
 * x, y, and rank are decided at insertion / placement (tools + setMemoryLayout).
 * This adapter copies them through. Missing values default to 0 (legacy rows).
 *
 * Memory.name → GraphNode.label; PART_OF source=child target=parent.
 * Incidence / rim derived after map via recomputeIncidence / RimLock.
 */

import {
  emptyNodeIncidence,
  recomputeIncidence,
  type GraphData,
  type GraphEdge,
  type GraphNode,
} from "./graph-data";
import type { Links, Memory } from "@/types/graph-schema";

/**
 * Map product Memory nodes + Links into canvas GraphData.
 * Trusts prefilled Memory.x / y / rank from the authoring path.
 */
export function memoryGraphToGraphData(input: {
  memories: Memory[];
  links: Links[];
}): GraphData {
  const idSet = new Set(input.memories.map((m) => m.id));

  const seenEdgeIds = new Set<string>();
  const edges: GraphEdge[] = input.links.filter(
    (link) =>
      (link.type === "PART_OF" || link.type === "RELATES_TO")
      && idSet.has(link.source)
      && idSet.has(link.target)
      && !seenEdgeIds.has(`${link.type}:${link.source}->${link.target}`)
  ).map((link) => {
    // PART_OF: keep source=child, target=parent (do not reverse).
    seenEdgeIds.add(`${link.type}:${link.source}->${link.target}`);

    return {
      id: `${link.type}:${link.source}->${link.target}`,
      source: link.source,
      target: link.target,
      type: link.type,
    };
  });

  const nodes: GraphNode[] = input.memories.map((memory) => {
    return {
      id: memory.id,
      label: memory.name,
      // Prefill from insertion/placement; 0 only if a legacy row lacks layout.
      x:
        typeof memory.x === "number" && Number.isFinite(memory.x)
          ? memory.x
          : 0,
      y:
        typeof memory.y === "number" && Number.isFinite(memory.y)
          ? memory.y
          : 0,
      rank:
        typeof memory.rank === "number" && Number.isFinite(memory.rank)
          ? Math.max(0, Math.floor(memory.rank))
          : 0,
      ...emptyNodeIncidence(),
    };
  });

  const graph: GraphData = { nodes, edges };
  recomputeIncidence(graph);
  return graph;
}
