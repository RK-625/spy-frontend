/**
 * Screen-space directed edges for Pixi.
 *
 * Single-pass continuous diverging dots along the edge from
 * hairline gap at start to hairline gap at end. Near each node the field
 * flares laterally, densifies, grows dot radius, and fans outer laterals
 * slightly closer to the rim — a soft crescent socket with no polar
 * terminal, no dual paint, and no multi-cell black moat.
 *
 * Direction of flow is left to future pulse animation across the cleft.
 *
 * Phase 1 perf:
 * - DotBatch: batch per-dot circle/rect into one fill() per style group (B).
 *
 * Phase 2b (quality-first GPU vector circles):
 * - DotEmit feeds the renderer's DotCircleBatch (triangle-mesh circles),
 *   not ParticleContainer sprites — geometry stays smooth at any zoom.
 * - drawEdge(graphics, ...) wraps DotBatch for backward compat / debug.
 * - drawEdgeDots(emit, ...) is the preferred API for the Pixi renderer.
 * - No density LOD (no lodMul / skipOuterLats) — full stream always;
 *   perf via GPU batching + pan-cache + viewport cull, not thinning.
 * - Soft alpha still quantizes to 12 steps for batch group keys only.
 */

import type { Graphics } from "pixi.js";

import {
  DOT_RADIUS_FRAC,
  DOT_STEP_FRAC,
  EDGE_DOT_AXIAL_FAN,
  EDGE_DOT_DENSIFY_GAIN,
  EDGE_DOT_FLARE_GAIN,
  EDGE_DOT_MORPH_ZONE_BAND_MULT,
  EDGE_DOT_MORPH_ZONE_CELL_MULT,
  EDGE_DOT_MORPH_ZONE_NODE_FRAC,
  EDGE_DOT_RADIUS_GROW,
  EDGE_SYNAPSE_GAP_FRAC,
  EDGE_SYNAPSE_GAP_MIN,
  edgeStripLayout,
} from "./graph-scale";

export type ScreenPoint = { x: number; y: number };

/**
 * Callback for emitting a single dot into the renderer's GPU batch
 * (DotCircleBatch) or a Graphics DotBatch for debug paths.
 */
export type DotEmit = (
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha: number
) => void;

/** Angular arc an edge's DotStream socket occupies at one node rim. */
export type RimSlot = {
  /** Direction from node center toward the neighbor (radians). */
  midAngle: number;
  /** Half-angular-span at the rim (radians). Dots beyond this are culled. */
  halfSpan: number;
};

export type DrawEdgeOptions = {
  color: number;
  alpha?: number;
  density?: "firm" | "soft";
  band: number;
  /** Start node (screen). */
  fromCenter: ScreenPoint;
  fromRadius: number;
  /** End / arrival node (screen). */
  toCenter: ScreenPoint;
  toRadius: number;
  /** Optional angular constraint at the source rim — culls dots outside arc. */
  sourceRim?: RimSlot;
  /** Optional angular constraint at the target rim. */
  targetRim?: RimSlot;
};

export function insetSegment(
  from: ScreenPoint,
  to: ScreenPoint,
  insetFrom: number,
  insetTo: number
): { start: ScreenPoint; end: ScreenPoint } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const padFrom = Math.max(0, insetFrom);
  const padTo = Math.max(0, insetTo);
  if (!Number.isFinite(length) || length <= padFrom + padTo) {
    return null;
  }
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: from.x + ux * padFrom, y: from.y + uy * padFrom },
    end: { x: to.x - ux * padTo, y: to.y - uy * padTo },
  };
}

function unitAlong(
  from: ScreenPoint,
  to: ScreenPoint
): { ux: number; uy: number; length: number } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 0.5) return null;
  return { ux: dx / length, uy: dy / length, length };
}

/**
 * Batch dots sharing the same color+alpha into one path + single fill call.
 * Flushes automatically when style changes or via flush().
 */
class DotBatch {
  private g: Graphics;
  private curColor: number = 0;
  private curAlpha: number = 0;
  private hasPending: boolean = false;

  constructor(g: Graphics) {
    this.g = g;
  }

  add(
    cx: number,
    cy: number,
    r: number,
    color: number,
    alpha: number
  ): void {
    if (
      this.hasPending &&
      (color !== this.curColor || alpha !== this.curAlpha)
    ) {
      this.flush();
    }
    if (!this.hasPending) {
      this.curColor = color;
      this.curAlpha = alpha;
      this.hasPending = true;
    }
    this.g.circle(cx, cy, r);
  }

  flush(): void {
    if (!this.hasPending) return;
    this.g.fill({ color: this.curColor, alpha: this.curAlpha });
    this.hasPending = false;
  }
}

/** Even hairline cleft between node border and first stream dots. */
function synapseGap(nodeRadius: number): number {
  return Math.max(EDGE_SYNAPSE_GAP_MIN, nodeRadius * EDGE_SYNAPSE_GAP_FRAC);
}

/** Classic smoothstep on [0, 1]. */
function smoothstep01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Normalize angle to [-π, π]. */
function normaliseAngle(a: number): number {
  let x = a % (2 * Math.PI);
  if (x > Math.PI) x -= 2 * Math.PI;
  if (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

/**
 * Morph zone length at one end — flare/densify/radius domain.
 * zone = max(band * 2.5, cell * 8, nodeR * 0.45)
 */
function morphZone(band: number, cell: number, nodeR: number): number {
  return Math.max(
    band * EDGE_DOT_MORPH_ZONE_BAND_MULT,
    cell * EDGE_DOT_MORPH_ZONE_CELL_MULT,
    nodeR * EDGE_DOT_MORPH_ZONE_NODE_FRAC
  );
}

/**
 * Single-pass continuous diverging DotStream along the edge attachments.
 *
 * Morph (s along edge, L = length):
 *   dFromAlong = s, dToAlong = L - s
 *   tFrom = smoothstep(1 - dFromAlong/zoneFrom), same for end
 *   near = max(tFrom, tTo)  — no double-apply widen
 *   widen = 1 + near * FLARE_GAIN
 *   latMax = round(halfBand * widen)
 *   localStep = cell * DOT_STEP_FRAC / (1 + near * DENSIFY_GAIN)
 *   localR = cell * DOT_RADIUS_FRAC * (1 + near * RADIUS_GROW)
 *   axial fan: outer lats may reach s0 - extra / s1 + extra toward node
 *   cull: dist(nodeCenter) >= nodeR + synapseGap
 */
const RIM_BLEND_CELLS = 2; // blend margin in cell-widths beyond halfSpan

function sampleDivergingStream(
  emit: DotEmit,
  from: ScreenPoint,
  to: ScreenPoint,
  band: number,
  color: number,
  alpha: number,
  density: "firm" | "soft",
  fromCenter: ScreenPoint,
  fromRadius: number,
  toCenter: ScreenPoint,
  toRadius: number,
  sourceRim?: RimSlot,
  targetRim?: RimSlot
): void {
  const dir = unitAlong(from, to);
  if (!dir) return;
  const { ux, uy, length: L } = dir;
  if (!Number.isFinite(L) || L < 1e-6) return;

  const { cols, cell } = edgeStripLayout(band, density);
  if (!Number.isFinite(cell) || cell <= 0) return;
  const halfBand = Math.floor((cols - 1) / 2);
  const px = -uy;
  const py = ux;

  const gapFrom = synapseGap(fromRadius);
  const gapTo = synapseGap(toRadius);
  const zoneFrom = morphZone(band, cell, fromRadius);
  const zoneTo = morphZone(band, cell, toRadius);
  // Avoid div-by-zero in near factors
  const zFrom = Math.max(zoneFrom, 1e-6);
  const zTo = Math.max(zoneTo, 1e-6);

  // Centerline domain: hairline past each rim. Short edges: full [0, L] bridge.
  let s0 = gapFrom;
  let s1 = L - gapTo;
  if (!(s1 > s0)) {
    s0 = 0;
    s1 = L;
  }

  // Expand sample domain for axial fan (outer laterals closer to nodes).
  const maxFan = EDGE_DOT_AXIAL_FAN * cell;
  const sSample0 = Math.max(0, s0 - maxFan);
  const sSample1 = Math.min(L, s1 + maxFan);
  if (!(sSample1 >= sSample0)) return;

  // Floor step so densest region still advances
  const minStep = Math.max(
    (cell * DOT_STEP_FRAC) / (1 + EDGE_DOT_DENSIFY_GAIN) * 0.5,
    0.05
  );

  // Quality-first: no density LOD (lodMul always 1; outer laterals kept).
  // Perf comes from GPU mesh batching + pan-cache + viewport cull.

  let s = sSample0;
  let guard = 0;
  const maxIters = Math.ceil((sSample1 - sSample0) / minStep) + cols * 4 + 64;

  while (s <= sSample1 + 1e-9 && guard < maxIters) {
    guard += 1;

    const dFromAlong = s;
    const dToAlong = L - s;
    const tFrom = smoothstep01(1 - dFromAlong / zFrom);
    const tTo = smoothstep01(1 - dToAlong / zTo);
    const near = tFrom > tTo ? tFrom : tTo;

    const widen = 1 + near * EDGE_DOT_FLARE_GAIN;
    const naturalLatMax = Math.max(0, Math.round(halfBand * widen));
    let latMax = naturalLatMax;
    // Rim lateral clamp + angular cull only when the socket is tighter than
    // natural flare at this sample. Uncrowded rims keep full flare + crescent.
    let sourceConstrained = false;
    let targetConstrained = false;
    if (sourceRim && naturalLatMax > 0) {
      const arcCols = Math.floor((sourceRim.halfSpan * fromRadius) / cell);
      if (arcCols < naturalLatMax) {
        sourceConstrained = true;
        if (tFrom >= tTo) latMax = Math.max(1, arcCols);
      }
    }
    if (targetRim && naturalLatMax > 0) {
      const arcCols = Math.floor((targetRim.halfSpan * toRadius) / cell);
      if (arcCols < naturalLatMax) {
        targetConstrained = true;
        if (tTo > tFrom) latMax = Math.max(1, arcCols);
      }
    }
    const localStep = Math.max(
      minStep,
      (cell * DOT_STEP_FRAC) / (1 + near * EDGE_DOT_DENSIFY_GAIN)
    );
    const localR = Math.max(
      0.15,
      cell * DOT_RADIUS_FRAC * (1 + near * EDGE_DOT_RADIUS_GROW)
    );

    // Soft mid-shaft alpha ramp (mild); firm stays flat
    const tAlong = L > 1e-6 ? s / L : 0.5;
    const baseAlphaRaw =
      density === "soft" ? alpha * (0.55 + 0.35 * tAlong) : alpha;
    // Quantise soft alpha to 12 steps so consecutive samples share a style
    // key for DotCircleBatch / Graphics DotBatch group flushes.
    const baseAlpha =
      density === "soft" ? Math.round(baseAlphaRaw * 12) / 12 : baseAlphaRaw;

    const latDenom = Math.max(latMax, 1);
    const stepIndex = Math.floor(s / localStep);

    for (let lat = -latMax; lat <= latMax; lat++) {
      const absLat = Math.abs(lat);
      const latFrac = absLat / latDenom;

      // Axial fan: outer laterals extend toward each node by end-local near
      const extraFrom = tFrom * EDGE_DOT_AXIAL_FAN * latFrac * cell;
      const extraTo = tTo * EDGE_DOT_AXIAL_FAN * latFrac * cell;
      if (s < s0 - extraFrom - 1e-6) continue;
      if (s > s1 + extraTo + 1e-6) continue;

      // Soft / outer-column density thinning (mid stream spirit)
      if (latMax > 0 && absLat === latMax && stepIndex % 2 === 0) {
        continue;
      }
      if (
        density === "soft" &&
        latMax > 1 &&
        absLat > latMax - 1 &&
        (stepIndex + lat) % 2 === 0
      ) {
        continue;
      }

      const cx = from.x + ux * s + px * lat * cell;
      const cy = from.y + uy * s + py * lat * cell;

      // Forbidden disks: node fill + hairline synapse (do not enlarge gap)
      const distFrom = Math.hypot(cx - fromCenter.x, cy - fromCenter.y);
      if (distFrom < fromRadius + gapFrom) continue;
      const distTo = Math.hypot(cx - toCenter.x, cy - toCenter.y);
      if (distTo < toRadius + gapTo) continue;

      // Angular rim cull only when the socket is actually constraining flare
      if (
        sourceConstrained &&
        sourceRim &&
        distFrom < fromRadius + gapFrom + RIM_BLEND_CELLS * cell
      ) {
        const dotAngle = normaliseAngle(
          Math.atan2(cy - fromCenter.y, cx - fromCenter.x)
        );
        const delta = Math.abs(normaliseAngle(dotAngle - sourceRim.midAngle));
        if (delta > sourceRim.halfSpan + RIM_BLEND_CELLS * cell / fromRadius) continue;
      }
      if (
        targetConstrained &&
        targetRim &&
        distTo < toRadius + gapTo + RIM_BLEND_CELLS * cell
      ) {
        const dotAngle = normaliseAngle(
          Math.atan2(cy - toCenter.y, cx - toCenter.x)
        );
        const delta = Math.abs(normaliseAngle(dotAngle - targetRim.midAngle));
        if (delta > targetRim.halfSpan + RIM_BLEND_CELLS * cell / toRadius) continue;
      }

      emit(cx, cy, localR, color, baseAlpha);
    }

    s += localStep;
  }
}

/**
 * Full edge: one continuous diverging DotStream (no polar pads, no dual pass).
 *
 * Graphics wrapper — uses DotBatch internally for backward compat and debug.
 * For production use drawEdgeDots(emit, ...) which feeds the GPU vector batch.
 */
export function drawEdge(
  graphics: Graphics,
  from: ScreenPoint,
  to: ScreenPoint,
  options: DrawEdgeOptions
): void {
  const alpha = options.alpha ?? 1;
  const density = options.density ?? "firm";
  const band = options.band;
  if (!Number.isFinite(band) || band <= 0) return;
  if (!options.fromCenter || !options.toCenter) return;
  if (!Number.isFinite(options.fromRadius) || !Number.isFinite(options.toRadius)) {
    return;
  }

  const batch = new DotBatch(graphics);
  const emit: DotEmit = (cx, cy, r, colorVal, alphaVal) => {
    batch.add(cx, cy, r, colorVal, alphaVal);
  };

  sampleDivergingStream(
    emit,
    from,
    to,
    band,
    options.color,
    alpha,
    density,
    options.fromCenter,
    options.fromRadius,
    options.toCenter,
    options.toRadius,
    options.sourceRim,
    options.targetRim
  );
  batch.flush();
}

/**
 * Full-edge DotStream fed directly into an external emit callback
 * (typically DotCircleBatch.add). Same morph math as drawEdge but avoids
 * Graphics fill overhead entirely.
 */
export function drawEdgeDots(
  emit: DotEmit,
  from: ScreenPoint,
  to: ScreenPoint,
  options: DrawEdgeOptions
): void {
  const alpha = options.alpha ?? 1;
  const density = options.density ?? "firm";
  const band = options.band;
  if (!Number.isFinite(band) || band <= 0) return;
  if (!options.fromCenter || !options.toCenter) return;
  if (!Number.isFinite(options.fromRadius) || !Number.isFinite(options.toRadius)) {
    return;
  }

  sampleDivergingStream(
    emit,
    from,
    to,
    band,
    options.color,
    alpha,
    density,
    options.fromCenter,
    options.fromRadius,
    options.toCenter,
    options.toRadius,
    options.sourceRim,
    options.targetRim
  );
}
