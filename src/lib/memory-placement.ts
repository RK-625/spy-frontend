/**
 * Client pose helpers — pure rank / placed-pose checks (no geometry engine).
 *
 * =============================================================================
 * POLICY — client-placement-cache (plans/client-placement-cache.md)
 * =============================================================================
 *
 * Design locks:
 *  - Placement SoT is **client-only**: d3 settle (`force-recipe`) + browser
 *    `localStorage` (`placement-cache.ts`) by topology fingerprint.
 *  - Falkor holds topology only — no product `x`/`y`/`rank` writes.
 *  - Rank is **client-derived** from PART_OF (child = parent + 1; roots = 0).
 *  - LLM tools never author layout; toolset never settles or persists pose.
 *
 * This module is thin pure helpers for verify / pose gating on GraphNode or
 * cache rows (`isPlacedLayout`, `rankAfterParent`). It is **not** a server
 * place-on-upsert policy surface (those gates were removed).
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
 * Shared spacing token for callers that need the same constant.
 */
export const PARENT_CHILD_RADIUS = 56;

/**
 * Near-origin epsilon for settle **gating** (matches force-recipe ORIGIN_EPSILON).
 * Finite xy both within this of 0 count as **unplaced** seeds, not real layout.
 */
export const LAYOUT_ORIGIN_EPSILON = 1e-3;

// ---------------------------------------------------------------------------
// Rank & pose helpers (pure)
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
 * True when a layout has a **real** placed pose (not a near-origin seed).
 * Requires finite x and y, and **not** both within LAYOUT_ORIGIN_EPSILON of 0.
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
