/**
 * Graph scale hub — all node + edge sizing tokens and pure formulas.
 * Palette stays in graph-style.ts. No Pixi imports.
 *
 * Formulas (z = usableZoom):
 *   nodeR(rank)     = NODE_BASE_PX * NODE_RANK_Q^rank * z
 *   band(kind, rF)  = EDGE_BASE_BAND * NODE_RANK_Q^rankFactor * z
 *                     * (relates ? EDGE_RELATES_WIDTH_SCALE : 1)
 *   strip: cols fixed by density (firm/soft); cell = band / cols
 *
 * Rank factor:
 *   PART_OF  → parent rank only (data target)
 *   RELATES  → min(source.rank, target.rank)
 */

// ---------------------------------------------------------------------------
// Tokens (tune here)
// ---------------------------------------------------------------------------

/** Root node radius at zoom 1. */
export const NODE_BASE_PX = 8;
/**
 * Parent→child size ratio — shared by nodes and edge band.
 * Same Q ladder: deeper ranks are smaller/thinner by Q each step.
 */
export const NODE_RANK_Q = 0.8;

/**
 * PART_OF band thickness at zoom 1 (screen px) — pure linear with zoom.
 * cell = band / cols keeps firm ~10 / soft ~7 columns.
 */
export const EDGE_BASE_BAND = 2.268;

/**
 * Reference grain at zoom 1 (node ring / legacy helpers).
 * A/B strips use edgeStripLayout: cell = band / cols.
 */
export const EDGE_BASE_CELL = 0.85;

/** Target columns across the strip (density in a fixed band). */
export const EDGE_COLS_FIRM = 10;
export const EDGE_COLS_SOFT = 7;

/** RELATES_TO band quieter than PART_OF at the same rank factor. */
export const EDGE_RELATES_WIDTH_SCALE = 0.75;

/** Pixel-strip fill / step fractions (air between squares). */
export const PIXEL_FILL_FRAC = 0.34;
export const PIXEL_STEP_FRAC = 1.06;

/** Dot-matrix radius / step fractions (air between dots). */
export const DOT_RADIUS_FRAC = 0.32;
export const DOT_STEP_FRAC = 1.05;

/** Subpixel cull for node draw (formula itself has no min radius). */
export const NODE_DRAW_MIN_PX = 0.25;

/**
 * Synaptic cleft: gap between node fill border and inner edge of rim-arc.
 * Primarily a fraction of tip node radius so spacing stays even at any zoom;
 * min floor so small nodes still show a hairline gap for future pulse.
 */
export const EDGE_SYNAPSE_GAP_MIN = 1.5;
export const EDGE_SYNAPSE_GAP_FRAC = 0.07;

/** Rim-arc angular half-span (radians) — short crescent, not a long wrap. */
export const EDGE_RIM_ARC_HALF_SPAN_FIRM = 0.36; // ~41° total
export const EDGE_RIM_ARC_HALF_SPAN_SOFT = 0.28; // ~32° total

/** Radial thickness of the rim arc (rows of cells/dots outside the gap). */
export const EDGE_RIM_ARC_ROWS_FIRM = 3;
export const EDGE_RIM_ARC_ROWS_SOFT = 2;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function usableZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom !== 0 ? Math.abs(zoom) : 1;
}

/**
 * PART_OF: parent = target.rank (source=child, target=parent).
 * RELATES: min(source, target).
 */
export function edgeRankFactor(
  kind: "part_of" | "relates",
  sourceRank: number,
  targetRank: number
): number {
  const src = Number.isFinite(sourceRank) ? sourceRank : 0;
  const tgt = Number.isFinite(targetRank) ? targetRank : 0;
  if (kind === "part_of") return tgt;
  return Math.min(src, tgt);
}

/** Node radius: NODE_BASE_PX * NODE_RANK_Q^rank * z */
export function nodeScreenRadius(
  rank: number | undefined,
  zoom: number
): number {
  return NODE_BASE_PX * NODE_RANK_Q ** (rank ?? 0) * usableZoom(zoom);
}

/**
 * Band thickness — pure linear zoom × Q^rankFactor.
 * No min/max growth caps.
 */
export function edgeBandWidth(
  zoom: number,
  kind: "part_of" | "relates",
  sourceRank: number,
  targetRank: number
): number {
  const z = usableZoom(zoom);
  const rankFactor = edgeRankFactor(kind, sourceRank, targetRank);
  let band = EDGE_BASE_BAND * NODE_RANK_Q ** rankFactor * z;
  if (kind === "relates") {
    band *= EDGE_RELATES_WIDTH_SCALE;
  }
  return band;
}

/**
 * Reference grain (linear). Prefer edgeStripLayout for A/B draw paths so
 * column density matches band thickness.
 */
export function edgeCellSize(zoom: number): number {
  return EDGE_BASE_CELL * usableZoom(zoom);
}

/**
 * Target column count across the strip (fixed density targets).
 * firm = EDGE_COLS_FIRM; soft = EDGE_COLS_SOFT.
 */
export function edgeColumnCount(
  _band: number,
  _cell: number,
  density: "firm" | "soft"
): number {
  return density === "firm" ? EDGE_COLS_FIRM : EDGE_COLS_SOFT;
}

/**
 * Layout for pixel/dot strips: denser cols in the given band → smaller cells.
 * Drawn lateral span ≈ (cols - 1) * cell ≈ band.
 */
export function edgeStripLayout(
  band: number,
  density: "firm" | "soft"
): { cols: number; cell: number } {
  const cols = density === "firm" ? EDGE_COLS_FIRM : EDGE_COLS_SOFT;
  const safeBand =
    Number.isFinite(band) && band > 0 ? band : EDGE_BASE_BAND;
  const cell = safeBand / cols;
  return { cols, cell };
}

/** Head length target so row count tracks cell, not magic ints. */
export function edgeHeadLengthTarget(
  band: number,
  cell: number,
  cols: number
): number {
  return Math.max(band * 2.2, cell * cols * 0.9);
}

export function edgeHeadRows(headLenTarget: number, cell: number): number {
  if (!Number.isFinite(cell) || cell <= 0) return 6;
  return Math.max(6, Math.round(headLenTarget / cell));
}

/** Node ring tracks reference grain (tiny floor so stroke never vanishes). */
export function nodeRingWidth(zoom: number): number {
  const cell = edgeCellSize(zoom);
  return Math.max(0.25, cell * 0.5);
}

/** PART_OF band at zoom with parent rank 0 (verify / thin API helper). */
export function edgeScreenWidth(zoom: number): number {
  return edgeBandWidth(zoom, "part_of", 0, 0);
}
