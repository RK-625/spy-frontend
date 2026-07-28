/**
 * Pure Memory-like[] + Links[] → GraphData adapter (no Falkor, Pixi, React, or fetch).
 *
 * Accepts full `Memory` rows or lean `/api/graph` topology rows (`MemoryGraphNodeInput`).
 * Maps to canvas GraphData only — does **not** recompute layout or rank.
 *
 * Cold-start contract (Slice 2): missing or non-finite Memory `x`/`y` means
 * layout is required. The adapter may still seed GraphData `x`/`y` to `0` for
 * DTO shape, but those zeros are seeds only — not final placement. Callers that
 * want final positions must settle when `needsLayout` is true (S0
 * `settleGraphData` / `settleIfNeeded`). Detect needs-layout from Memories
 * before/during map (`memoriesNeedLayout` / `memoryGraphToGraphDataWithMeta`);
 * after map, missing coords are indistinguishable from a real origin placement.
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
import type { Links } from "@/types/graph-schema";

/**
 * Lean node input for canvas mapping (full Memory or `/api/graph` topology rows).
 * Embeddings are not required — layout/rank/name only.
 */
export type MemoryGraphNodeInput = {
  id: string;
  name: string;
  x?: number | null;
  y?: number | null;
  rank?: number | null;
};

/** True when both world coords are finite numbers (placed). */
export function hasFiniteLayoutXY(x: unknown, y: unknown): boolean {
  return (
    typeof x === "number" &&
    Number.isFinite(x) &&
    typeof y === "number" &&
    Number.isFinite(y)
  );
}

/** True when this Memory row lacks a finite layout pair (needs settle). */
export function memoryNeedsLayout(
  memory: Pick<MemoryGraphNodeInput, "x" | "y">
): boolean {
  return !hasFiniteLayoutXY(memory.x, memory.y);
}

/** True when any Memory in the set lacks finite x/y. */
export function memoriesNeedLayout(
  memories: ReadonlyArray<Pick<MemoryGraphNodeInput, "x" | "y">>
): boolean {
  return memories.some(memoryNeedsLayout);
}

export type MemoryGraphMapResult = {
  graph: GraphData;
  /** True when ≥1 memory lacked finite x/y (seeds are not final placement). */
  needsLayout: boolean;
};

/**
 * Map product Memory nodes + Links into canvas GraphData.
 * Trusts prefilled Memory.x / y / rank from the authoring path.
 * Missing x/y seed to 0 — use `memoryGraphToGraphDataWithMeta` or
 * `memoriesNeedLayout` when final placement is required.
 */
export function memoryGraphToGraphData(input: {
  memories: MemoryGraphNodeInput[];
  links: Links[];
}): GraphData {
  return memoryGraphToGraphDataWithMeta(input).graph;
}

/**
 * Same map as `memoryGraphToGraphData`, plus an explicit `needsLayout` flag
 * computed from Memories before zeros are seeded into GraphData.
 */
export function memoryGraphToGraphDataWithMeta(input: {
  memories: MemoryGraphNodeInput[];
  links: Links[];
}): MemoryGraphMapResult {
  const needsLayout = memoriesNeedLayout(input.memories);
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
      // Prefill from insertion/placement; 0 is a seed only when layout is missing.
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
  return { graph, needsLayout };
}
