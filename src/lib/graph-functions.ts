import { DirectedGraph } from "graphology";

import type { Links, MemoryNode } from "@/types/graph-schema";

export const POINT_COLOR = "#c8acfb";
export const LINK_PARENT_OF = "#8a96b4";
export const LINK_RELATES = "#9a7ab8";
/** FA2 edge weight for RELATES_TO (not a layout spring). */
export const RELATES_FA2_WEIGHT = 0.3;
export const EDGE_SIZE = 1;

export interface SigmaNodeAttrs {
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
}

export interface SigmaEdgeAttrs {
  color: string;
  size: number;
  type: "arrow" | "line";
  weight: number;
}

export type SigmaGraph = DirectedGraph<SigmaNodeAttrs, SigmaEdgeAttrs>;

export type NodeHierarchy = {
  ranks: Map<string, number>;
  /** Domain apex. `null` = no PARENT_OF. Domain root maps to itself. */
  rootById: Map<string, string | null>;
};

type Walk = { rank: number; rootId: string | null };

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
      rootId == null ? POINT_COLOR : shade(hueOf(rootId), ranks.get(id) ?? 0),
    );
  }
  return colors;
}

/**
 * Node sizes are screen pixels for Sigma. Rank weight alone (0–1) would
 * render as sub-pixel dots — scale to readable screen pixels.
 * Root largest; deeper ranks smaller.
 */
export const POINT_SIZE_BASE_PX = 15;

/** Root ≈ POINT_SIZE_BASE_PX; deeper → smaller (rank 1 ≈ 4, rank 2 ≈ 2.67, …). */
export function sizeFromRank(rank: number): number {
  return POINT_SIZE_BASE_PX / (rank + 1);
}

/** PARENT_OF spring from child rank. Inverse of parent+child size pair; no cap. Rank 1 ≈ 0.67; deeper → stronger. */
export function strengthFromChildRank(childRank: number): number {
  const r = Math.max(1, childRank);
  return (r * (r + 1)) / (2 * r + 1);
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

/** Circle-seeded topology only — FA2 runs live after Sigma mounts. */
export function buildLayoutGraph(
  memories: MemoryNode[],
  links: Links[],
): SigmaGraph {
  const graph = new DirectedGraph<SigmaNodeAttrs, SigmaEdgeAttrs>();
  const ids = memories.map((memory) => memory.id);
  const hierarchy = findNodeRanks(ids, links);
  const colors = findNodeColors(hierarchy);
  const sizes = findNodeSizes(hierarchy);
  const count = memories.length;
  memories.forEach((memory, index) => {
    const angle = (2 * Math.PI * index) / Math.max(count, 1);
    graph.addNode(memory.id, {
      x: Math.cos(angle),
      y: Math.sin(angle),
      size: sizes.get(memory.id) ?? 1,
      color: colors.get(memory.id) ?? POINT_COLOR,
      label: memory.name,
    });
  });
  for (const link of links) {
    if (!graph.hasNode(link.source) || !graph.hasNode(link.target)) continue;
    if (graph.hasEdge(link.source, link.target)) continue;
    const isParentOf = link.type === "PARENT_OF";
    graph.addEdge(link.source, link.target, {
      color: isParentOf ? LINK_PARENT_OF : LINK_RELATES,
      size: EDGE_SIZE,
      type: isParentOf ? "arrow" : "line",
      weight: isParentOf
        ? strengthFromChildRank(hierarchy.ranks.get(link.target) ?? 1)
        : RELATES_FA2_WEIGHT,
    });
  }

  return graph;
}
