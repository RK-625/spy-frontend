/**
 * Pure incremental GraphData settle helpers (no Falkor I/O).
 *
 * Product placement path is **client-only** — see `plans/client-placement-cache.md`
 * and `src/lib/graph/placement-cache.ts`. Server toolsets never call settle/persist.
 *
 * This module keeps pure subgraph settle utilities for verify scripts and
 * optional offline experiments. It does **not** write placement to Falkor.
 */

import {
  settleGraphData,
  applyColdStartJitter,
  ORIGIN_EPSILON,
  type SettleGraphOptions,
} from "@/lib/graph/force-recipe";
import type { GraphData } from "@/lib/graph/graph-data";

export type SettleAndPersistOptions = {
  /**
   * Weave focus ids (link source / cold node). Expanded to 1-hop neighborhood.
   * Omit or empty → settle whole graph and persist every node.
   */
  focusIds?: readonly string[];
  /**
   * Node ids forced pinned even if inside the movable neighborhood
   * (PART_OF parent as geometry anchor). Stay in subgraph for forces; not dirty.
   */
  anchorIds?: readonly string[];
  /**
   * Rank overrides applied on the in-memory GraphData before settle
   * (e.g. PART_OF child = parent.rank + 1). Force never invents rank.
   */
  rankOverrides?: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
  /** Forwarded to settleGraphData (ticks / force knobs). */
  settle?: SettleGraphOptions;
};

export type IncrementalSettleResult = {
  graph: GraphData;
  /** Node ids that may be written (movable + rank overrides). */
  dirtyIds: ReadonlySet<string>;
  /** True when non-dirty nodes were pinned / held as anchors during settle. */
  pinned: boolean;
};

function rankOverrideFor(
  id: string,
  overrides: SettleAndPersistOptions["rankOverrides"],
): number | undefined {
  if (overrides == null) return undefined;
  // ReadonlyMap is not eliminated by `instanceof Map` in the false branch.
  if (overrides instanceof Map) {
    const v = overrides.get(id);
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  }
  const record = overrides as Readonly<Record<string, number>>;
  const v = record[id];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function rankOverrideIds(
  overrides: SettleAndPersistOptions["rankOverrides"],
): string[] {
  if (overrides == null) return [];
  if (overrides instanceof Map) return [...overrides.keys()];
  return Object.keys(overrides as Readonly<Record<string, number>>);
}

function cloneGraphDataLocal(graph: GraphData): GraphData {
  return {
    nodes: graph.nodes.map((n) => ({
      ...n,
      childIds: [...n.childIds],
      parentIds: [...n.parentIds],
      relateIds: [...n.relateIds],
      rimOccupations: n.rimOccupations.map((r) => ({ ...r })),
    })),
    edges: graph.edges.map((e) => ({ ...e })),
  };
}

/**
 * Expand focus ids to a 1-hop neighborhood via edges + incidence lists.
 * Also includes every rank-override id.
 */
export function expandFocusNeighborhood(
  graph: GraphData,
  focusIds: readonly string[],
  rankOverrides?: SettleAndPersistOptions["rankOverrides"],
): Set<string> {
  const focus = new Set(focusIds.filter((id) => id.length > 0));
  for (const id of rankOverrideIds(rankOverrides)) {
    focus.add(id);
  }

  const movable = new Set(focus);
  if (focus.size === 0) return movable;

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const e of graph.edges) {
    if (focus.has(e.source)) movable.add(e.target);
    if (focus.has(e.target)) movable.add(e.source);
  }

  for (const id of focus) {
    const n = byId.get(id);
    if (n == null) continue;
    for (const nbr of n.childIds) movable.add(nbr);
    for (const nbr of n.parentIds) movable.add(nbr);
    for (const nbr of n.relateIds) movable.add(nbr);
  }

  return movable;
}

/**
 * Neighbors of movable that lie outside the movable set (boundary anchors).
 */
export function expandAnchorRing(
  graph: GraphData,
  movable: ReadonlySet<string>,
): Set<string> {
  const anchors = new Set<string>();
  if (movable.size === 0) return anchors;

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const e of graph.edges) {
    if (movable.has(e.source) && !movable.has(e.target)) anchors.add(e.target);
    if (movable.has(e.target) && !movable.has(e.source)) anchors.add(e.source);
  }

  for (const id of movable) {
    const n = byId.get(id);
    if (n == null) continue;
    for (const nbr of n.childIds) {
      if (!movable.has(nbr)) anchors.add(nbr);
    }
    for (const nbr of n.parentIds) {
      if (!movable.has(nbr)) anchors.add(nbr);
    }
    for (const nbr of n.relateIds) {
      if (!movable.has(nbr)) anchors.add(nbr);
    }
  }

  // Drop ids absent from the graph.
  for (const id of [...anchors]) {
    if (!byId.has(id)) anchors.delete(id);
  }

  return anchors;
}

/** Movable + anchor nodes and edges with both endpoints in that set. */
export function buildSettleSubgraph(
  graph: GraphData,
  movable: ReadonlySet<string>,
  anchors: ReadonlySet<string>,
): GraphData {
  const keep = new Set<string>([...movable, ...anchors]);
  return {
    nodes: graph.nodes
      .filter((n) => keep.has(n.id))
      .map((n) => ({
        ...n,
        childIds: [...n.childIds],
        parentIds: [...n.parentIds],
        relateIds: [...n.relateIds],
        rimOccupations: n.rimOccupations.map((r) => ({ ...r })),
      })),
    edges: graph.edges
      .filter((e) => keep.has(e.source) && keep.has(e.target))
      .map((e) => ({ ...e })),
  };
}

function applyRankOverrides(
  graph: GraphData,
  overrides: SettleAndPersistOptions["rankOverrides"],
): void {
  if (overrides == null) return;
  for (const node of graph.nodes) {
    const override = rankOverrideFor(node.id, overrides);
    if (override !== undefined) {
      node.rank = Math.max(0, Math.floor(override));
    }
  }
}

/**
 * Pure incremental settle: apply rank overrides → subgraph settle → merge.
 * Does not touch Falkor. Used by verify smoke only (product path is client cache).
 */
export function settleMemoryGraphIncremental(
  graph: GraphData,
  options?: SettleAndPersistOptions,
): IncrementalSettleResult {
  const focusIds = options?.focusIds ?? [];
  const forcedAnchorIds = new Set(
    (options?.anchorIds ?? []).filter((id) => id.length > 0),
  );
  const hasFocus =
    focusIds.length > 0 || rankOverrideIds(options?.rankOverrides).length > 0;

  const working = cloneGraphDataLocal(graph);
  applyRankOverrides(working, options?.rankOverrides);

  // Empty focus → full free settle + persist all (cold / bulk).
  // Forced anchors still pin when present (rare for cold path).
  if (!hasFocus) {
    const dirtyIds = new Set(working.nodes.map((n) => n.id));
    for (const id of forcedAnchorIds) dirtyIds.delete(id);

    if (
      working.nodes.some(
        (n) =>
          !forcedAnchorIds.has(n.id) &&
          Math.abs(n.x) <= ORIGIN_EPSILON &&
          Math.abs(n.y) <= ORIGIN_EPSILON,
      )
    ) {
      const free = working.nodes.filter((n) => !forcedAnchorIds.has(n.id));
      applyColdStartJitter(free);
    }

    const pinnedNodeIds =
      forcedAnchorIds.size > 0 ? [...forcedAnchorIds] : undefined;
    // Pure verify / non-product path — never write client placement cache.
    const settled = settleGraphData(working, {
      ...options?.settle,
      pinnedNodeIds,
      saveCache: false,
    });
    return {
      graph: settled,
      dirtyIds,
      pinned: forcedAnchorIds.size > 0,
    };
  }

  const neighborhood = expandFocusNeighborhood(
    working,
    focusIds,
    options?.rankOverrides,
  );
  for (const id of rankOverrideIds(options?.rankOverrides)) {
    neighborhood.add(id);
  }

  // Movable = neighborhood minus forced anchors (parent pin for PART_OF).
  const movable = new Set(
    [...neighborhood].filter(
      (id) =>
        !forcedAnchorIds.has(id) &&
        working.nodes.some((n) => n.id === id),
    ),
  );

  // Dirty for persist: movable + rank overrides (even if override id is anchor).
  const dirtyIds = new Set(movable);
  for (const id of rankOverrideIds(options?.rankOverrides)) {
    if (working.nodes.some((n) => n.id === id)) dirtyIds.add(id);
  }
  // Forced anchors without rank override are not dirty.
  for (const id of forcedAnchorIds) {
    if (rankOverrideFor(id, options?.rankOverrides) === undefined) {
      dirtyIds.delete(id);
    }
  }

  if (movable.size === 0) {
    // Rank-only path possible when everything is anchored / already placed.
    return {
      graph: working,
      dirtyIds,
      pinned: forcedAnchorIds.size > 0 || working.nodes.length > 0,
    };
  }

  // Boundary anchors + forced pins (parent, etc.).
  const anchors = expandAnchorRing(working, movable);
  for (const id of forcedAnchorIds) {
    if (working.nodes.some((n) => n.id === id)) anchors.add(id);
  }

  const subgraph = buildSettleSubgraph(working, movable, anchors);

  // Cold-start jitter only on movable nodes that need it.
  const movableRefs = subgraph.nodes.filter((n) => movable.has(n.id));
  if (
    movableRefs.some(
      (n) =>
        Math.abs(n.x) <= ORIGIN_EPSILON && Math.abs(n.y) <= ORIGIN_EPSILON,
    )
  ) {
    applyColdStartJitter(movableRefs);
  }

  const pinnedNodeIds = [...anchors];
  // Never write placement cache from a subgraph settle (would poison full topo key).
  const settledSub = settleGraphData(subgraph, {
    ...options?.settle,
    pinnedNodeIds: pinnedNodeIds.length > 0 ? pinnedNodeIds : undefined,
    saveCache: false,
  });

  const settledById = new Map(settledSub.nodes.map((n) => [n.id, n]));
  const out = cloneGraphDataLocal(working);
  for (const node of out.nodes) {
    if (!movable.has(node.id)) continue;
    const s = settledById.get(node.id);
    if (s == null) continue;
    node.x = s.x;
    node.y = s.y;
  }

  const pinned =
    anchors.size > 0 || out.nodes.some((n) => !movable.has(n.id));

  return { graph: out, dirtyIds, pinned };
}
