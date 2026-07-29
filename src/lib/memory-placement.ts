/**
 * Memory layout helpers — rank + settle policy (geometry SoT is d3 settle).
 *
 * =============================================================================
 * POLICY (system-owned layout) — locked (Slice 5/6 + settle false-positive cleanup)
 * =============================================================================
 *
 * Design locks:
 *  - x, y are system-owned — never on tool input schemas; never LLM-authored.
 *  - rank is system-derived: PART_OF child = parent.rank + 1; roots / orphans = 0.
 *  - Durable geometry: shared `settleGraphData` / `settleAndPersistMemoryPlacements`
 *    (P-A persist via setMemoryPlacement). Fan/spiral place* APIs removed (S6);
 *    snapshot under `src/deprecated/memory-placement-geometry.ts`.
 *  - **Create:** write rank 0 only; leave x/y null — **do not settle** on create alone
 *    (no topology yet; near-origin seeds poison finite-layout gates).
 *  - Content-only upsert: **do not settle** if `isPlacedLayout` (finite, non-origin).
 *  - Missing / near-origin xy later: cold path (update) or link path settles.
 *  - PART_OF link: always apply rank override; geometry settle only when child
 *    unplaced (parent pinned via `anchorIds`); rank-only write when placed but
 *    rank wrong; skip when placed and rank already parent+1.
 *  - RELATES_TO: always settle on link (topology change / edge pull).
 *
 * Prefer `rankAfterParent` + `settleAndPersistMemoryPlacements({ focusIds, anchorIds })`.
 */

export type LayoutCoords = {
  x?: number | null;
  y?: number | null;
};

export type LayoutWithRank = LayoutCoords & {
  rank?: number | null;
};

/**
 * Preferred hierarchy distance (matches force-recipe PART_OF_DISTANCE).
 * Kept here so rank/policy callers share the same spacing token.
 */
export const PARENT_CHILD_RADIUS = 56;

/**
 * Near-origin epsilon for settle **gating** (matches force-recipe ORIGIN_EPSILON).
 * Finite xy both within this of 0 count as **unplaced** seeds, not real layout.
 */
export const LAYOUT_ORIGIN_EPSILON = 1e-3;

// ---------------------------------------------------------------------------
// Rank & settle policy helpers (pure; for toolset / callers)
// ---------------------------------------------------------------------------

/**
 * Child hierarchy depth given parent rank.
 */
export function rankAfterParent(parentRank: number): number {
  const base = Number.isFinite(parentRank) ? Math.floor(parentRank) : 0;
  return Math.max(0, base) + 1;
}

/** Alias: child rank = parent.rank + 1. */
export function recomputeRankFromParent(parentRank: number): number {
  return rankAfterParent(parentRank);
}

/**
 * True when a memory has a **real** placed layout for settle gating.
 * Requires finite x and y, and **not** both within LAYOUT_ORIGIN_EPSILON of 0
 * (adapter / cold-start seeds at origin count as unplaced).
 *
 * Does not change adapter DTO seeding of 0 — only gating semantics.
 */
export function isPlacedLayout(
  layout: LayoutCoords | null | undefined,
): boolean {
  if (layout == null) return false;
  const { x, y } = layout;
  if (x == null || y == null) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (
    Math.abs(x) <= LAYOUT_ORIGIN_EPSILON &&
    Math.abs(y) <= LAYOUT_ORIGIN_EPSILON
  ) {
    return false;
  }
  return true;
}

/**
 * Whether layout is still required for this row (create, missing, or near-origin).
 * true for create OR when existing is not `isPlacedLayout`.
 *
 * **Toolset:** must not call settle on create alone — only cold (update missing
 * xy) and link paths settle. This flag still means "needs layout eventually."
 */
export function shouldPlaceOnUpsert(args: {
  isNew: boolean;
  existing: LayoutCoords | null;
}): boolean {
  if (args.isNew) return true;
  return !isPlacedLayout(args.existing);
}

/**
 * Whether linkMemories should run a **force settle** for this edge.
 * - RELATES_TO: always (topology change; edge can pull nodes).
 * - PART_OF: only when the child (source) lacks a placed layout.
 *   Rank-only updates when placed but rank wrong are handled outside settle.
 */
export function shouldPlaceOnLink(args: {
  type: "PART_OF" | "RELATES_TO";
  sourceLayout: LayoutWithRank | null;
}): boolean {
  if (args.type === "RELATES_TO") return true;
  return !isPlacedLayout(args.sourceLayout);
}

/**
 * True when PART_OF child rank is missing or not parent.rank + 1.
 */
export function partOfRankNeedsUpdate(args: {
  sourceLayout: LayoutWithRank | null;
  parentRank: number;
}): boolean {
  const expected = rankAfterParent(args.parentRank);
  const current = args.sourceLayout?.rank;
  if (current == null || !Number.isFinite(current)) return true;
  return Math.floor(current) !== expected;
}
