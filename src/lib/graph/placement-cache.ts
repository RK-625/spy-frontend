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
 // TODO: HAS FALLBACK FOR CYCLIC AND DUAL PARENT NODES
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

  for (const m of memories) {
    if (!ranks.has(m.id)) {
      ranks.set(m.id, 0);
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
