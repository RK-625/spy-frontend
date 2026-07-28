/**
 * Memory layout helpers — rank + settle policy (geometry SoT is d3 settle).
 *
 * =============================================================================
 * POLICY (system-owned layout) — locked (Slice 5/6)
 * =============================================================================
 *
 * Design locks:
 *  - x, y are system-owned — never on tool input schemas; never LLM-authored.
 *  - rank is system-derived: PART_OF child = parent.rank + 1; roots / orphans = 0.
 *  - Durable geometry: shared `settleGraphData` / `settleAndPersistMemoryLayouts`
 *    (P-A persist via setMemoryLayout). Fan/spiral place* APIs removed (S6);
 *    snapshot under `src/deprecated/memory-placement-geometry.ts`.
 *  - Content-only upsert: **do not settle** if finite x/y exist (shouldPlaceOnUpsert).
 *  - PART_OF link: always re-settle child rank + geometry when linking.
 *  - RELATES_TO: settle only when source lacks finite x/y.
 *
 * Prefer `rankAfterParent` + `settleAndPersistMemoryLayouts({ focusIds })`.
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

function hasFiniteLayout(layout: LayoutCoords | null | undefined): boolean {
  if (layout == null) return false;
  return (
    layout.x != null &&
    layout.y != null &&
    Number.isFinite(layout.x) &&
    Number.isFinite(layout.y)
  );
}

/**
 * Whether layout settle should run on upsert.
 * true only if create OR existing row is missing finite x/y.
 * Content-only updates with finite layout must not re-settle.
 */
export function shouldPlaceOnUpsert(args: {
  isCreate: boolean;
  existing: LayoutCoords | null;
}): boolean {
  if (args.isCreate) return true;
  return !hasFiniteLayout(args.existing);
}

/**
 * @deprecated Prefer shouldPlaceOnUpsert.
 */
export function shouldReplaceLayout(
  existing: LayoutCoords | null,
  isCreate: boolean,
): boolean {
  return shouldPlaceOnUpsert({ isCreate, existing });
}

/**
 * Whether linkMemories should settle layout for the **source** node.
 * - PART_OF: always (rank + settle).
 * - RELATES_TO: only if source is missing finite x/y.
 */
export function shouldPlaceOnLink(args: {
  type: "PART_OF" | "RELATES_TO";
  sourceLayout: LayoutWithRank | null;
}): boolean {
  if (args.type === "PART_OF") return true;
  return !hasFiniteLayout(args.sourceLayout);
}
