/**
 * Pure Memory-like[] + Links[] → GraphData adapter (no Falkor, Pixi, React, or fetch).
 *
 * Accepts full `Memory` rows or lean `/api/graph` topology rows (`MemoryGraphNodeInput`).
 * Placement policy: **client-placement-cache** (`plans/client-placement-cache.md`).
 * Falkor / API topology is content + links only — no layout fields on Memory.
 *
 * Cold-start / settle-gating contract (MVP C3):
 * - Filter/dedupe edges first (same set as GraphData), then derive ranks + fingerprint.
 * - localStorage cache hit (full) → paint cached poses; `needsLayout = false`.
 * - Cache miss → deterministic `seedNodePosition(id)` + `needsLayout = true`;
 *   callers run client `settleGraphData` (which saves the cache under the same
 *   filtered-edge fingerprint). No Falkor writes.
 * - Progressive BFS stream (invisible-until-posed) is **C3b deferred**;
 *   `computeBfsOrder` orders the node list for stable intro.
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
} from "../core/graph-data";
import type { Links } from "@/types/graph-schema";
import {
  computeBfsOrder,
  computeTopoFingerprint,
  deriveRanks,
  loadPlacementCache,
  seedNodePosition,
} from "./placement-cache";

/**
 * Lean node input for canvas mapping (full Memory or `/api/graph` topology rows).
 * Embeddings are not required. Pose comes from client cache / seeds only —
 * topology input has no layout fields (Falkor holds content + links only).
 */
export type MemoryGraphNodeInput = {
  id: string;
  name: string;
  /** Memory body — shown in node-inspect modal; not used by bake. */
  content?: string | null;
  impression?: string | null;
  confidence?: number | null;
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
 * Filter raw links to the same PART_OF / RELATES_TO edge set as GraphData:
 * valid type, both endpoints in the memory id set, de-duplicated.
 * Fingerprint load/save and settle must use this set (not raw input.links).
 */
export function filterTopologyLinks(
  memories: ReadonlyArray<{ id: string }>,
  links: ReadonlyArray<Links>
): GraphEdge[] {
  const idSet = new Set(memories.map((m) => m.id));
  const seenEdgeIds = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const link of links) {
    if (link.type !== "PART_OF" && link.type !== "RELATES_TO") continue;
    if (!idSet.has(link.source) || !idSet.has(link.target)) continue;
    const key = `${link.type}:${link.source}->${link.target}`;
    if (seenEdgeIds.has(key)) continue;
    seenEdgeIds.add(key);
    edges.push({
      id: key,
      source: link.source,
      target: link.target,
      type: link.type,
    });
  }

  return edges;
}

export type MemoryGraphMapResult = {
  graph: GraphData;
  /**
   * True when the client placement cache is a miss (not every node has a valid
   * cached pose for this topology fingerprint). Caller should one-shot settle
   * and let `settleGraphData` write localStorage. False → paint cache as-is.
   */
  needsLayout: boolean;
  /** Topology fingerprint used for cache load (algoVersion + ranks + filtered edges). */
  fingerprint: string;
};

/**
 * Map product Memory nodes + Links into canvas GraphData.
 * Poses come from client placement cache or deterministic seeds — never API xy.
 */
export function memoryGraphToGraphData(input: {
  memories: MemoryGraphNodeInput[];
  links: Links[];
}): GraphData {
  return memoryGraphToGraphDataWithMeta(input).graph;
}

/**
 * Same map as `memoryGraphToGraphData`, plus `needsLayout` / fingerprint.
 * `needsLayout` is `!fullCacheHit` for live topology (API xy ignored).
 *
 * Fingerprint uses the **filtered** edge set (same as GraphData / settle save).
 */
export function memoryGraphToGraphDataWithMeta(input: {
  memories: MemoryGraphNodeInput[];
  links: Links[];
}): MemoryGraphMapResult {
  // Filter first so load fingerprint matches settleGraphData save fingerprint.
  const edges = filterTopologyLinks(input.memories, input.links);
  const derivedRanks = deriveRanks(input.memories, edges);
  const fingerprint = computeTopoFingerprint(
    input.memories,
    edges,
    derivedRanks
  );
  const cache = loadPlacementCache(fingerprint);

  // Stable introduction order (C3b progressive can reuse; MVP applies all seeds).
  const bfsOrder = computeBfsOrder(input.memories, edges);
  const memoryById = new Map(input.memories.map((m) => [m.id, m]));
  const orderedIds =
    bfsOrder.length === input.memories.length
      ? bfsOrder
      : input.memories.map((m) => m.id);

  let cachedPoseCount = 0;
  const nodes: GraphNode[] = orderedIds.map((id) => {
    const memory = memoryById.get(id)!;
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

    if (hasValidCachedPose) {
      cachedPoseCount += 1;
    }

    // Client cache or deterministic seed only — never API / Falkor xy.
    const seed = seedNodePosition(memory.id);
    const x = hasValidCachedPose ? cached.x : seed.x;
    const y = hasValidCachedPose ? cached.y : seed.y;
    const rank =
      hasValidCachedPose && typeof cached.rank === "number"
        ? cached.rank
        : (derivedRanks.get(memory.id) ?? 0);

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

  const fullCacheHit =
    input.memories.length > 0 && cachedPoseCount === input.memories.length;
  // Empty graph: nothing to settle.
  const needsLayout = input.memories.length > 0 && !fullCacheHit;

  const graph: GraphData = { nodes, edges };
  recomputeIncidence(graph);
  return { graph, needsLayout, fingerprint };
}
