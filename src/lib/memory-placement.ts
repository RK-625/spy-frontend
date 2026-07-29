/**
 * Memory layout helpers — pure rank / settle-gate policy (no geometry engine).
 *
 * =============================================================================
 * POLICY — client-placement-cache (plans/client-placement-cache.md)
 * =============================================================================
 *
 * Design locks:
 *  - x, y, rank are **not** durable Falkor fields for product placement.
 *  - Client d3 (`force-recipe` / `settleGraphData`) computes poses; browser
 *    `localStorage` (`placement-cache.ts`) caches them by topology fingerprint.
 *  - Rank is **client-derived** from PART_OF (child = parent + 1; roots = 0).
 *  - LLM tools never author x/y/rank; toolset never settles or persists layout.
 *  - Fan/spiral geometry APIs were removed (S6); do not resurrect.
 *
 * Remaining helpers here are pure gates used by verify scripts and any caller
 * that still reasons about “is this pose real vs seed” on GraphData / cache
 * rows (`isPlacedLayout`, rankAfterParent). Server product path does not place.
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
// Rank & settle policy helpers (pure)
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
 * True when a layout has a **real** placed pose for settle gating.
 * Requires finite x and y, and **not** both within LAYOUT_ORIGIN_EPSILON of 0
 * (origin seeds count as unplaced).
 *
 * Used on GraphNode / cache poses — not on API topology (which has no xy).
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
 * Whether layout would still be required under the old API-xy model
 * (create, missing, or near-origin). Live `/graph` uses cache fingerprint
 * instead (`memoryGraphToGraphDataWithMeta.needsLayout`).
 */
export function shouldPlaceOnUpsert(args: {
  isNew: boolean;
  existing: LayoutCoords | null;
}): boolean {
  if (args.isNew) return true;
  return !isPlacedLayout(args.existing);
}

/**
 * Whether a link event would have triggered server force-settle historically.
 * Product path no longer settles on the server; retained for pure verify.
 * - RELATES_TO: always (topology change).
 * - PART_OF: only when the child lacks a placed layout.
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
