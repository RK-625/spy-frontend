/**
 * Pure Memory-like[] + Links[] → GraphData adapter (no Falkor, Pixi, React, or fetch).
 *
 * Accepts full `Memory` rows or lean `/api/graph` topology rows (`MemoryGraphNodeInput`).
 * Maps to canvas GraphData only — does **not** recompute layout or rank.
 *
 * Cold-start / settle-gating contract:
 * Missing, non-finite, **or near-origin** Memory `x`/`y` means layout is required
 * (`isPlacedLayout` / `memoryNeedsLayout`). Near-origin seeds (both within
 * LAYOUT_ORIGIN_EPSILON of 0) count as unplaced for settle gating — same policy
 * as server toolset. The adapter may still seed GraphData `x`/`y` to `0` for
 * DTO shape; those zeros are seeds only — not final placement. Callers that want
 * final positions must settle when `needsLayout` is true (S0 `settleGraphData` /
 * session incremental settle). Detect needs-layout from Memories before/during
 * map (`memoriesNeedLayout` / `memoryGraphToGraphDataWithMeta`).
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
import { isPlacedLayout } from "@/lib/memory-placement";
import type { Links } from "@/types/graph-schema";
import {
  deriveRanks,
  computeTopoFingerprint,
  loadPlacementCache,
} from "./placement-cache";

/**
 * Lean node input for canvas mapping (full Memory or `/api/graph` topology rows).
 * Embeddings are not required — layout/rank/name + optional inspect fields.
 */
export type MemoryGraphNodeInput = {
  id: string;
  name: string;
  /** Memory body — shown in node-inspect modal; not used by bake. */
  content?: string | null;
  impression?: string | null;
  confidence?: number | null;
  x?: number | null;
  y?: number | null;
  rank?: number | null;
};

/** True when both world coords are finite numbers (raw; ignores origin seed). */
export function hasFiniteLayoutXY(x: unknown, y: unknown): boolean {
  return (
    typeof x === "number" &&
    Number.isFinite(x) &&
    typeof y === "number" &&
    Number.isFinite(y)
  );
}

/**
 * True when this Memory row needs settle (missing, non-finite, or near-origin seed).
 * Uses shared `isPlacedLayout` — near-origin counts as unplaced for gating.
 */
export function memoryNeedsLayout(
  memory: Pick<MemoryGraphNodeInput, "x" | "y">
): boolean {
  return !isPlacedLayout({ x: memory.x, y: memory.y });
}

/** True when any Memory in the set needs settle. */
export function memoriesNeedLayout(
  memories: ReadonlyArray<Pick<MemoryGraphNodeInput, "x" | "y">>
): boolean {
  return memories.some(memoryNeedsLayout);
}

export type MemoryGraphMapResult = {
  graph: GraphData;
  /**
   * True when ≥1 memory is unplaced (missing / non-finite / near-origin seed).
   * Adapter still seeds GraphData zeros for DTO shape when missing.
   */
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
 * Checks placement-cache for existing cached pose based on topology fingerprint.
 */
export function memoryGraphToGraphDataWithMeta(input: {
  memories: MemoryGraphNodeInput[];
  links: Links[];
}): MemoryGraphMapResult {
  const derivedRanks = deriveRanks(input.memories, input.links);
  const fingerprint = computeTopoFingerprint(
    input.memories,
    input.links,
    derivedRanks
  );
  const cache = loadPlacementCache(fingerprint);

  let needsLayout = false;
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
    const content =
      typeof memory.content === "string" ? memory.content : undefined;
    const impression =
      typeof memory.impression === "string" ? memory.impression : undefined;
    const confidence =
      typeof memory.confidence === "number" &&
      Number.isFinite(memory.confidence)
        ? memory.confidence
        : undefined;

    const cached = cache?.[memory.id];
    const hasValidCachedPose =
      cached !== undefined &&
      typeof cached.x === "number" &&
      Number.isFinite(cached.x) &&
      typeof cached.y === "number" &&
      Number.isFinite(cached.y);

    if (!hasValidCachedPose && memoryNeedsLayout(memory)) {
      needsLayout = true;
    }

    const x = hasValidCachedPose
      ? cached.x
      : typeof memory.x === "number" && Number.isFinite(memory.x)
      ? memory.x
      : 0;

    const y = hasValidCachedPose
      ? cached.y
      : typeof memory.y === "number" && Number.isFinite(memory.y)
      ? memory.y
      : 0;

    const rank = derivedRanks.get(memory.id) ?? 0;

    return {
      id: memory.id,
      label: memory.name,
      ...(content !== undefined ? { content } : {}),
      ...(impression !== undefined ? { impression } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      x,
      y,
      rank,
      ...emptyNodeIncidence(),
    };
  });

  const graph: GraphData = { nodes, edges };
  recomputeIncidence(graph);
  return { graph, needsLayout };
}
