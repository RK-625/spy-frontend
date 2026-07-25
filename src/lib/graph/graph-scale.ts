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
 *
 * Edge language is DotStream only (continuous diverging dots).
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
 * Reference grain at zoom 1 — node ring width / verify helpers only.
 * Not the DotStream cell size; DotStream cell = band / cols via edgeStripLayout.
 */
export const EDGE_BASE_CELL = 0.85;

/** Target columns across the strip (density in a fixed band). */
export const EDGE_COLS_FIRM = 10;
export const EDGE_COLS_SOFT = 7;

/** RELATES_TO band quieter than PART_OF at the same rank factor. */
export const EDGE_RELATES_WIDTH_SCALE = 0.75;

/**
 * Fraction of the full rim (2π) that edge sockets may occupy after natural
 * band→angle conversion. Residual free arc is split as equal gaps in RimLock.
 */
export const EDGE_RIM_FILL_FRAC = 0.85;

/** DotStream radius / step fractions (air between dots). */
export const DOT_RADIUS_FRAC = 0.32;
export const DOT_STEP_FRAC = 1.05;

/** Subpixel cull for node draw (formula itself has no min radius). */
export const NODE_DRAW_MIN_PX = 0.25;

/**
 * Synaptic cleft: hairline gap between node fill border and first edge dots.
 * Fraction of node radius keeps spacing even at any zoom.
 *
 * E′: screen-px floor removed so world bake + zoom scale is exact;
 * gap remains hairline via frac alone (trust frac for quality).
 * Deprecated — kept as 0 for backward compat; only EDGE_SYNAPSE_GAP_FRAC is used.
 */
export const EDGE_SYNAPSE_GAP_MIN = 0;
export const EDGE_SYNAPSE_GAP_FRAC = 0.04;

// ---------------------------------------------------------------------------
// Continuous diverging DotStream (single-pass cartesian morph)
// ---------------------------------------------------------------------------

/** Lateral half-band growth at node rims: widen = 1 + near * gain (~2.2×). */
export const EDGE_DOT_FLARE_GAIN = 1.2;

/** Along-edge step densification near rims: step /= (1 + near * gain). */
export const EDGE_DOT_DENSIFY_GAIN = 0.85;

/** Dot radius growth near rims: r *= (1 + near * gain). */
export const EDGE_DOT_RADIUS_GROW = 0.35;

/**
 * Morph zone length per end (smoothstep near-factor domain):
 *   zone = max(band * BAND_MULT, cell * CELL_MULT, nodeR * NODE_FRAC)
 */
export const EDGE_DOT_MORPH_ZONE_BAND_MULT = 2.5;
export const EDGE_DOT_MORPH_ZONE_CELL_MULT = 8;
export const EDGE_DOT_MORPH_ZONE_NODE_FRAC = 0.45;

/**
 * Axial fan-out: outer laterals may reach closer to the node than the
 * centerline by extra = near * AXIAL_FAN * (|lat|/latMax) * cell — soft
 * crescent socket without a second polar paint pass.
 */
export const EDGE_DOT_AXIAL_FAN = 1.2;

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
 * Reference grain (linear) for node ring / verify — not DotStream cell.
 * DotStream cell comes from edgeStripLayout (band / cols).
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
 * Layout for DotStream: denser cols in the given band → smaller cells.
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

/** Node ring tracks reference grain (tiny floor so stroke never vanishes). */
export function nodeRingWidth(zoom: number): number {
  const cell = edgeCellSize(zoom);
  return Math.max(0.25, cell * 0.5);
}

/** PART_OF band at zoom with parent rank 0 (verify / thin API helper). */
export function edgeScreenWidth(zoom: number): number {
  return edgeBandWidth(zoom, "part_of", 0, 0);
}
