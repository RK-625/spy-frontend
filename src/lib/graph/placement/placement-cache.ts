/**
 * Placement Cache & Rank Derivation (Slice C2)
 *
 * Provides:
 * - Deterministic tree rank derivation from PART_OF links (roots = 0, children = parent + 1)
 * - Deterministic topology fingerprint hashing
 * - LocalStorage persistence for client graph placement poses
 */

export const PLACEMENT_ALGO_VERSION = 1;
export const PLACEMENT_CACHE_STORAGE_KEY = "spy:graph-placement:v1";

import type { GraphEdge, GraphNode } from "../core/graph-data.ts";

export type CachedPlacementNode = {
  x: number;
  y: number;
  rank: number;
};

export type PlacementCacheData = {
  algoVersion: number;
  fingerprint: string;
  nodes: Record<string, CachedPlacementNode>;
};

/**
 * Derive hierarchical ranks for memory nodes based on PART_OF links (source=child, target=parent).
 * Root nodes (no outgoing PART_OF link) get rank 0.
 * Children get parent.rank + 1.
 * Cycle guard / unvisited fallback to rank 0.
 */
export function deriveRanks(
  memories: ReadonlyArray<{ id: string }>,
  links: ReadonlyArray<{ source: string; target: string; type: string }>
): Map<string, number> {
  const ranks = new Map<string, number>(); // node id to rank
  const parentMap = new Map<string, string>(); // parent node to child node
  const memoryIds = new Set(memories.map((m) => m.id));

  for (const link of links) {
    if (
      link.type === "PART_OF" &&
      memoryIds.has(link.source) &&
      memoryIds.has(link.target)
    ) {
      parentMap.set(link.source, link.target);
    }
  }

  const visiting = new Set<string>();

  function computeRank(id: string): number {
    if (ranks.has(id)) {
      return ranks.get(id)!;
    }

    if (visiting.has(id)) {
      // Cycle detected: return 0 for cyclic edge
      return 0;
    }

    const parentId = parentMap.get(id);
    if (!parentId) {
      ranks.set(id, 0);
      return 0;
    }

    visiting.add(id);
    const parentRank = computeRank(parentId);
    visiting.delete(id);

    const rank = parentRank + 1;
    ranks.set(id, rank);
    return rank;
  }

  for (const m of memories) {
    if (!ranks.has(m.id)) {
      computeRank(m.id);
    }
  }

  return ranks;
}

/**
 * Compute a deterministic topology fingerprint string.
 * Format: `${algoVersion}|${nodesWithRanks.join(";")}|${sortedLinks.join(";")}`
 */
export function computeTopoFingerprint(
  memories: ReadonlyArray<{ id: string }>,
  links: ReadonlyArray<{ source: string; target: string; type: string }>,
  ranks: Map<string, number>,
  algoVersion = PLACEMENT_ALGO_VERSION
): string {
  const sortedNodeIds = memories.map((m) => m.id).sort();
  const nodesWithRanks = sortedNodeIds.map(
    (id) => `${id}:${ranks.get(id) ?? 0}`
  );

  const sortedLinkKeys = links
    .map((l) => `${l.type}:${l.source}->${l.target}`)
    .sort();

  return `${algoVersion}|${nodesWithRanks.join(";")}|${sortedLinkKeys.join(";")}`;
}

/**
 * Safely load placement cache from localStorage if fingerprint and algoVersion match.
 */
export function loadPlacementCache(
  fingerprint: string
): Record<string, CachedPlacementNode> | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(PLACEMENT_CACHE_STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as PlacementCacheData;
    if (
      data &&
      typeof data === "object" &&
      data.fingerprint === fingerprint &&
      data.algoVersion === PLACEMENT_ALGO_VERSION &&
      data.nodes &&
      typeof data.nodes === "object"
    ) {
      return data.nodes;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely save placement cache to localStorage.
 */
export function savePlacementCache(
  fingerprint: string,
  nodes: Record<string, CachedPlacementNode>
): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    const data: PlacementCacheData = {
      algoVersion: PLACEMENT_ALGO_VERSION,
      fingerprint,
      nodes,
    };
    localStorage.setItem(PLACEMENT_CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage writing errors ignored (quota/disabled)
  }
}

/**
 * Simple deterministic hash from `id` mapping to x in [-200, 200] and y in [-200, 200].
 * Ensures cold/unposed nodes get deterministic seed positions instead of hardcoded (0, 0).
 */
export function seedNodePosition(id: string): { x: number; y: number } {
  let h1 = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h1 ^= id.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
  }
  const u1 = (h1 >>> 0) / 4294967295;

  let h2 = Math.imul(h1 ^ 0x85ebca6b, 0xc2b2ae35);
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  const u2 = h2 / 4294967295;

  const x = -200 + u1 * 400;
  const y = -200 + u2 * 400;
  return { x, y };
}

/**
 * Compute BFS traversal placement order starting from the node with maximum total degree.
 * Across PART_OF and RELATES_TO links. Ties broken deterministically by alphabetical ID.
 * Appends any unvisited orphan nodes at the end sorted by ID.
 */
export function computeBfsOrder(
  memories: ReadonlyArray<{ id: string }>,
  links: ReadonlyArray<{ source: string; target: string; type?: string }>
): string[] {
  const memoryIds = new Set(memories.map((m) => m.id));
  const degree = new Map<string, number>();
  const adj = new Map<string, Set<string>>();

  for (const m of memories) {
    degree.set(m.id, 0);
    adj.set(m.id, new Set<string>());
  }

  for (const link of links) {
    const isTypeValid =
      !link.type || link.type === "PART_OF" || link.type === "RELATES_TO";
    if (
      isTypeValid &&
      memoryIds.has(link.source) &&
      memoryIds.has(link.target) &&
      link.source !== link.target
    ) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
      adj.get(link.source)?.add(link.target);
      adj.get(link.target)?.add(link.source);
    }
  }

  const visited = new Set<string>();
  const order: string[] = [];

  while (visited.size < memories.length) {
    let bestId: string | null = null;
    let maxDeg = -1;

    for (const m of memories) {
      if (visited.has(m.id)) continue;
      const deg = degree.get(m.id) ?? 0;
      if (deg > maxDeg || (deg === maxDeg && (bestId === null || m.id < bestId))) {
        maxDeg = deg;
        bestId = m.id;
      }
    }

    if (bestId === null) break;

    if (maxDeg === 0) {
      const orphans = memories
        .map((m) => m.id)
        .filter((id) => !visited.has(id))
        .sort();
      for (const orphan of orphans) {
        visited.add(orphan);
        order.push(orphan);
      }
      break;
    }

    const queue: string[] = [bestId];
    visited.add(bestId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      const neighbors = Array.from(adj.get(current) ?? []).sort();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return order;
}
