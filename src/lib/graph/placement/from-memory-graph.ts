/**
 * Pure Memory-like[] + Links[] → GraphData adapter (no Falkor, Pixi, React, or fetch).
 *
 * Accepts full `Memory` rows or lean `/api/graph` topology rows (`MemoryGraphNodeInput`).
 * Placement policy: **client-placement-cache** (`plans/client-placement-cache.md`).
 * Falkor / API topology is content + links only — no layout fields on Memory.
 *
 * Cold-start / settle-gating contract (MVP C3):
 * - Filter/dedupe edges first (same set as GraphData), then derive ranks + fingerprint.
 * - localStorage fingerprint hit → paint cached poses; `needsLayout = false`.
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
 *
 * Wire SoT for live topology rows is `GraphTopologyMemory` (`@/types/graph-topology`);
 * that type is assignable here (required fields satisfy these optionals).
 * Keep this type looser so full `Memory` rows still map without casting.
 */
export type MemoryGraphNodeInput = {
  id: string;
  name: string;
  /** Memory body — shown in node-inspect modal; not used by bake. */
  content?: string;
  impression?: string;
  confidence?: number;
};

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

export type GraphMapResult = {
  graph: GraphData;
  /**
   * True when `loadPlacementCache(fingerprint)` misses (`null`).
   * Caller should one-shot settle; `settleGraphData` writes localStorage.
   * False → paint loaded poses (same fingerprint as last save).
   */
  needsLayout: boolean;
  /** Topology fingerprint used for cache load (algoVersion + ranks + filtered edges). */
  fingerprint: string;
};

/**
 * Map product Memory nodes + Links into canvas GraphData + needsLayout.
 * Poses come from client placement cache or deterministic seeds — never API xy.
 * Hit/miss is fingerprint-keyed: `needsLayout = memories.length > 0 && cache == null`.
 *
 * Fingerprint uses the **filtered** edge set (same as GraphData / settle save).
 */
export function memoryGraphToGraphDataWithMeta(input: {
  memories: MemoryGraphNodeInput[];
  links: Links[];
}): GraphMapResult {
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

  const nodes: GraphNode[] = orderedIds.map((id) => {
    const memory = memoryById.get(id)!;
    const cached = cache?.[memory.id];
    const seed = seedNodePosition(memory.id);
    return {
      id: memory.id,
      label: memory.name,
      content: memory.content,
      impression: memory.impression,
      confidence: memory.confidence,
      x: cached?.x ?? seed.x,
      y: cached?.y ?? seed.y,
      rank: cached?.rank ?? derivedRanks.get(memory.id) ?? 0,
      ...emptyNodeIncidence(),
    };
  });

  // Empty topology: nothing to settle. Hit = fingerprint matched in load.
  const needsLayout = input.memories.length > 0 && cache == null;
  const graph: GraphData = { nodes, edges };
  recomputeIncidence(graph);
  return { graph, needsLayout, fingerprint };
}
