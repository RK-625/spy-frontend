/**
 * Server-side P-A layout settle + persist (Slice 5 / incremental scale).
 *
 * Shared pure recipe (`settleGraphData`) places the topology; settled world
 * `x` / `y` and topology-derived `rank` are written via `setMemoryLayout`.
 * Call only when topology/placement must change (create, link, missing xy).
 * Content-only upserts must not call this (no reshuffle).
 *
 * Persist policy **P-A** (locked): durable settled coords for stable reopen.
 * Client `/graph` never writes layout.
 *
 * Incremental policy (scale):
 * Pass `focusIds` for the weave event (new node, PART_OF child, RELATES source).
 * We expand to a 1-hop neighborhood (incident edges + incidence lists), pin
 * every other node with d3 `fx`/`fy`, run the shared recipe on the full graph,
 * and `setMemoryLayout` only for the movable / rank-override dirty set.
 * Empty focus → full free settle + persist all nodes (cold / bulk). If the
 * movable set is empty or covers most of the graph (≥50%), fall back to a
 * full free settle and persist every node (so free motion stays durable).
 * Ranks never come from force — apply `rankOverrides` before settle.
 */

import { listGraphTopology, setMemoryLayout } from "@/lib/falkor";
import { memoryGraphToGraphDataWithMeta } from "@/lib/graph/from-memory-graph";
import {
  settleGraphData,
  applyColdStartJitter,
  ORIGIN_EPSILON,
  type SettleGraphOptions,
} from "@/lib/graph/force-recipe";
import type { GraphData } from "@/lib/graph/graph-data";

/** When movable fraction ≥ this, skip pinning (full free settle). */
const FULL_SETTLE_MOVABLE_RATIO = 0.5;

export type SettleAndPersistOptions = {
  /**
   * Weave focus ids (create / link source). Expanded to 1-hop neighborhood.
   * Omit or empty → settle whole graph and persist every node.
   */
  focusIds?: readonly string[];
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
  /** True when non-dirty nodes were pinned during settle. */
  pinned: boolean;
};

function rankOverrideFor(
  id: string,
  overrides: SettleAndPersistOptions["rankOverrides"],
): number | undefined {
  if (overrides == null) return undefined;
  if (overrides instanceof Map) {
    const v = overrides.get(id);
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  }
  const v = overrides[id];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function rankOverrideIds(
  overrides: SettleAndPersistOptions["rankOverrides"],
): string[] {
  if (overrides == null) return [];
  if (overrides instanceof Map) return [...overrides.keys()];
  return Object.keys(overrides);
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
 * Pure incremental settle: apply rank overrides → pin non-dirty → settle.
 * Does not touch Falkor. Used by persist path and verify smoke.
 */
export function settleMemoryGraphIncremental(
  graph: GraphData,
  options?: SettleAndPersistOptions,
): IncrementalSettleResult {
  const focusIds = options?.focusIds ?? [];
  const hasFocus = focusIds.length > 0 || rankOverrideIds(options?.rankOverrides).length > 0;

  // Clone via settleGraphData's clone; apply ranks on a working copy first.
  const working: GraphData = {
    nodes: graph.nodes.map((n) => ({
      ...n,
      childIds: [...n.childIds],
      parentIds: [...n.parentIds],
      relateIds: [...n.relateIds],
      rimOccupations: n.rimOccupations.map((r) => ({ ...r })),
    })),
    edges: graph.edges.map((e) => ({ ...e })),
  };
  applyRankOverrides(working, options?.rankOverrides);

  let dirtyIds: Set<string>;
  let pinnedNodeIds: string[] | undefined;
  let pinned = false;

  if (!hasFocus) {
    dirtyIds = new Set(working.nodes.map((n) => n.id));
  } else {
    dirtyIds = expandFocusNeighborhood(
      working,
      focusIds,
      options?.rankOverrides,
    );
    // Ensure every override id is dirty even if absent from topology briefly.
    for (const id of rankOverrideIds(options?.rankOverrides)) {
      dirtyIds.add(id);
    }

    const n = working.nodes.length;
    const movableCount = [...dirtyIds].filter((id) =>
      working.nodes.some((node) => node.id === id),
    ).length;
    const usePin =
      movableCount > 0 &&
      n > 0 &&
      movableCount / n < FULL_SETTLE_MOVABLE_RATIO;

    if (usePin) {
      pinnedNodeIds = working.nodes
        .map((node) => node.id)
        .filter((id) => !dirtyIds.has(id));
      pinned = pinnedNodeIds.length > 0;
    } else {
      // No useful pin set (empty / huge neighborhood): free settle whole graph
      // and persist every node so free motion stays durable.
      dirtyIds = new Set(working.nodes.map((node) => node.id));
    }
  }

  // New weave nodes often seed at (0,0) on top of a parent — jitter dirty
  // nodes only so link/collide can separate without moving pinned seeds.
  const dirtyNodeRefs = working.nodes.filter((n) => dirtyIds.has(n.id));
  if (
    dirtyNodeRefs.some(
      (n) =>
        Math.abs(n.x) <= ORIGIN_EPSILON && Math.abs(n.y) <= ORIGIN_EPSILON,
    )
  ) {
    applyColdStartJitter(dirtyNodeRefs);
  }

  const settled = settleGraphData(working, {
    ...options?.settle,
    pinnedNodeIds,
  });

  return { graph: settled, dirtyIds, pinned };
}

/**
 * Load topology → incremental settle → persist dirty layouts only.
 * Returns the number of layouts written.
 */
export async function settleAndPersistMemoryLayouts(
  options?: SettleAndPersistOptions,
): Promise<{ written: number; dirty: number; pinned: boolean }> {
  const { memories, links } = await listGraphTopology();
  const { graph } = memoryGraphToGraphDataWithMeta({ memories, links });

  const { graph: settled, dirtyIds, pinned } = settleMemoryGraphIncremental(
    graph,
    options,
  );

  const beforeById = new Map(
    graph.nodes.map((n) => [n.id, { x: n.x, y: n.y, rank: n.rank }]),
  );

  let written = 0;
  for (const node of settled.nodes) {
    if (!dirtyIds.has(node.id)) continue;

    const prev = beforeById.get(node.id);
    const rankChanged = prev == null || prev.rank !== node.rank;
    const xyChanged =
      prev == null || prev.x !== node.x || prev.y !== node.y;
    // Always write rank overrides / missing prev; skip no-op xy+rank.
    const override = rankOverrideFor(node.id, options?.rankOverrides);
    if (!rankChanged && !xyChanged && override === undefined) continue;

    await setMemoryLayout({
      id: node.id,
      x: node.x,
      y: node.y,
      rank: node.rank,
    });
    written += 1;
  }

  return { written, dirty: dirtyIds.size, pinned };
}
