import type { Links } from "@/types/graph-schema";

export type NodeHierarchy = {
  ranks: Map<string, number>;
  /** Domain apex. `null` = no PARENT_OF. Domain root maps to itself. */
  rootById: Map<string, string | null>;
};

type Walk = { rank: number; rootId: string | null };

/** True if `childId` already has an incoming PARENT_OF (one parent max). */
export function childHasIncomingParentOf(
  links: readonly Links[],
  childId: string,
): boolean {
  return links.some(
    (link) => link.type === "PARENT_OF" && link.target === childId,
  );
}

/** PARENT_OF only. Parent → child. First parent wins. */
export function findNodeRanks(
  nodeIds: readonly string[],
  links: readonly Links[],
): NodeHierarchy {
  const parentByChild = new Map<string, string>();
  const isParent = new Set<string>();
  for (const { type, source, target } of links) {
    if (type !== "PARENT_OF") continue;
    isParent.add(source);
    if (!parentByChild.has(target)) parentByChild.set(target, source);
  }

  const ranks = new Map<string, number>();
  const rootById = new Map<string, string | null>();

  const walk = (id: string, trail: Set<string>): Walk => {
    if (rootById.has(id)) {
      return { rank: ranks.get(id) ?? 0, rootId: rootById.get(id) ?? null };
    }
    if (trail.has(id)) {
      ranks.set(id, 0);
      rootById.set(id, id);
      return { rank: 0, rootId: id };
    }
    const parentId = parentByChild.get(id);
    if (parentId == null) {
      const rootId = isParent.has(id) ? id : null;
      ranks.set(id, 0);
      rootById.set(id, rootId);
      return { rank: 0, rootId };
    }
    trail.add(id);
    const parent = walk(parentId, trail);
    trail.delete(id);
    const rank = parent.rank + 1;
    const rootId = parent.rootId ?? parentId;
    ranks.set(id, rank);
    rootById.set(id, rootId);
    return { rank, rootId };
  };

  for (const id of nodeIds) walk(id, new Set());
  return { ranks, rootById };
}

/** Same PARENT_OF root → same hue. Deeper rank → darker. No root → lavender. */
export function findNodeColors({
  ranks,
  rootById,
}: NodeHierarchy): Map<string, string> {
  const colors = new Map<string, string>();
  for (const [id, rootId] of rootById) {
    colors.set(
      id,
      rootId == null ? "#c8acfb" : shade(hueOf(rootId), ranks.get(id) ?? 0),
    );
  }
  return colors;
}

/**
 * Cosmograph `pointSizeStrategy: "direct"` treats values as pixel sizes 1:1
 * (cosmos default point is ~4; auto range is [2, 9]). Rank weight alone
 * (0–1) renders as sub-pixel dots — scale to readable screen pixels.
 * Root largest; deeper ranks smaller. Host keeps scalePointsOnZoom off.
 */
export const POINT_SIZE_BASE_PX = 8;

/** Root ≈ POINT_SIZE_BASE_PX; deeper → smaller (rank 1 ≈ 4, rank 2 ≈ 2.67, …). */
export function sizeFromRank(rank: number): number {
  return POINT_SIZE_BASE_PX / (rank + 1);
}

export function findNodeSizes({ ranks }: NodeHierarchy): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const [id, rank] of ranks) sizes.set(id, sizeFromRank(rank));
  return sizes;
}

function hueOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = (h >>> 0) % 334;
  return h >= 32 ? h + 26 : h;
}

function shade(h: number, rank: number): string {
  const l = Math.max(0.38, 0.62 - rank * 0.07);
  const a = 0.54 * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
