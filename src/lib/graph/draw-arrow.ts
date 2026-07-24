/**
 * Screen-space directed edges for Pixi Graphics.
 *
 * Shaft: pixel-strip (A) or dot-matrix (B).
 * Heads: rim arcs on **both** endpoints (landing pads).
 * Synaptic gap is only between **node fill border** and **arc** — shaft meets
 * the arc continuously (no extra void between stroke and rim).
 *
 * Direction of flow is left to future pulse animation across the cleft.
 */

import type { Graphics } from "pixi.js";

import {
  DOT_RADIUS_FRAC,
  DOT_STEP_FRAC,
  EDGE_RIM_ARC_HALF_SPAN_FIRM,
  EDGE_RIM_ARC_HALF_SPAN_SOFT,
  EDGE_RIM_ARC_ROWS_FIRM,
  EDGE_RIM_ARC_ROWS_SOFT,
  EDGE_SYNAPSE_GAP_FRAC,
  EDGE_SYNAPSE_GAP_MIN,
  PIXEL_FILL_FRAC,
  PIXEL_STEP_FRAC,
  edgeStripLayout,
} from "./graph-scale";

export type ScreenPoint = { x: number; y: number };

export type EdgeVisualStyle = "pixel-strip" | "dot-matrix";

export type DrawEdgeOptions = {
  color: number;
  alpha?: number;
  density?: "firm" | "soft";
  visual: EdgeVisualStyle;
  band: number;
  /** Start node (screen). */
  fromCenter: ScreenPoint;
  fromRadius: number;
  /** End / arrival node (screen). */
  toCenter: ScreenPoint;
  toRadius: number;
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

function fillOrientedSquare(
  graphics: Graphics,
  cx: number,
  cy: number,
  half: number,
  ux: number,
  uy: number,
  color: number,
  alpha: number
): void {
  const px = -uy;
  const py = ux;
  const corners: Array<[number, number]> = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  const pts: number[] = [];
  for (const [lx, ly] of corners) {
    pts.push(cx + ux * lx + px * ly, cy + uy * lx + py * ly);
  }
  graphics.poly(pts);
  graphics.fill({ color, alpha });
}

function fillDot(
  graphics: Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha: number
): void {
  graphics.circle(cx, cy, r);
  graphics.fill({ color, alpha });
}

/** Even cleft between node border and inner arc (scales with node size). */
function synapseGap(nodeRadius: number): number {
  return Math.max(EDGE_SYNAPSE_GAP_MIN, nodeRadius * EDGE_SYNAPSE_GAP_FRAC);
}

/**
 * Rim arc at a node: mid-angle faces the edge attachment on the rim.
 * Gap is only node→arc; shaft is expected to meet the inner arc radius.
 */
function drawRimArc(
  graphics: Graphics,
  nodeCenter: ScreenPoint,
  nodeRadius: number,
  /** Point on the node rim where the edge attaches. */
  attachment: ScreenPoint,
  cell: number,
  color: number,
  alpha: number,
  density: "firm" | "soft",
  visual: EdgeVisualStyle
): void {
  if (!Number.isFinite(nodeRadius) || nodeRadius < 0.5) return;

  const gap = synapseGap(nodeRadius);
  const midAngle = Math.atan2(
    attachment.y - nodeCenter.y,
    attachment.x - nodeCenter.x
  );
  const halfSpan =
    density === "firm"
      ? EDGE_RIM_ARC_HALF_SPAN_FIRM
      : EDGE_RIM_ARC_HALF_SPAN_SOFT;
  const radialRows =
    density === "firm" ? EDGE_RIM_ARC_ROWS_FIRM : EDGE_RIM_ARC_ROWS_SOFT;

  const half = cell * PIXEL_FILL_FRAC;
  const dotR = Math.max(0.15, cell * DOT_RADIUS_FRAC);
  const radialStep = cell * 0.95;

  for (let ring = 0; ring < radialRows; ring++) {
    // Inner ring sits at nodeRadius + gap (continuous with shaft end)
    const arcR = nodeRadius + gap + ring * radialStep + cell * 0.2;
    const arcLen = 2 * halfSpan * arcR;
    const steps = Math.max(4, Math.round(arcLen / Math.max(cell * 0.95, 0.35)));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = midAngle - halfSpan + t * 2 * halfSpan;
      const cx = nodeCenter.x + Math.cos(ang) * arcR;
      const cy = nodeCenter.y + Math.sin(ang) * arcR;

      if (
        density === "soft" &&
        ring === radialRows - 1 &&
        i % 2 === 1 &&
        i !== 0 &&
        i !== steps
      ) {
        continue;
      }

      if (visual === "pixel-strip") {
        const ax = -Math.sin(ang);
        const ay = Math.cos(ang);
        fillOrientedSquare(graphics, cx, cy, half, ax, ay, color, alpha);
      } else {
        fillDot(graphics, cx, cy, dotR, color, alpha);
      }
    }
  }
}

function sampleShaft(
  graphics: Graphics,
  from: ScreenPoint,
  ux: number,
  uy: number,
  s0: number,
  s1: number,
  cell: number,
  halfBand: number,
  color: number,
  alpha: number,
  density: "firm" | "soft",
  visual: EdgeVisualStyle
): void {
  if (s1 <= s0 + cell * 0.25) return;
  const px = -uy;
  const py = ux;

  if (visual === "pixel-strip") {
    const half = cell * PIXEL_FILL_FRAC;
    const latPitch = cell;
    const step = cell * PIXEL_STEP_FRAC;
    for (let s = s0; s < s1; s += step) {
      const cx = from.x + ux * s;
      const cy = from.y + uy * s;
      for (let lat = -halfBand; lat <= halfBand; lat++) {
        if (density === "soft") {
          if (Math.abs(lat) === halfBand && Math.floor(s / step) % 2 === 0) {
            continue;
          }
          if (Math.abs(lat) > halfBand - 1 && halfBand > 1) {
            if ((Math.floor(s / step) + lat) % 2 === 0) continue;
          }
        }
        fillOrientedSquare(
          graphics,
          cx + px * lat * latPitch,
          cy + py * lat * latPitch,
          half,
          ux,
          uy,
          color,
          alpha
        );
      }
    }
  } else {
    const pitch = cell;
    const r = Math.max(0.15, pitch * DOT_RADIUS_FRAC);
    const latPitch = pitch;
    const step = pitch * DOT_STEP_FRAC;
    const length = Math.max(s1 - s0, 1);
    for (let s = s0; s < s1; s += step) {
      const t = (s - s0) / length;
      const a = density === "soft" ? alpha * (0.55 + 0.35 * t) : alpha;
      for (let lat = -halfBand; lat <= halfBand; lat++) {
        if (
          halfBand > 0 &&
          Math.abs(lat) === halfBand &&
          Math.floor(s / step) % 2 === 0
        ) {
          continue;
        }
        if (
          density === "soft" &&
          halfBand > 1 &&
          Math.abs(lat) > halfBand - 1 &&
          (Math.floor(s / step) + lat) % 2 === 0
        ) {
          continue;
        }
        fillDot(
          graphics,
          from.x + ux * s + px * lat * latPitch,
          from.y + uy * s + py * lat * latPitch,
          r,
          color,
          a
        );
      }
    }
  }
}

/**
 * Full edge: rim at both nodes + shaft that meets each inner arc (no stroke↔rim void).
 */
function drawEdgeBody(
  graphics: Graphics,
  from: ScreenPoint,
  to: ScreenPoint,
  band: number,
  color: number,
  alpha: number,
  density: "firm" | "soft",
  visual: EdgeVisualStyle,
  fromCenter: ScreenPoint,
  fromRadius: number,
  toCenter: ScreenPoint,
  toRadius: number
): void {
  const dir = unitAlong(from, to);
  if (!dir) return;
  const { ux, uy, length } = dir;

  const { cols, cell } = edgeStripLayout(band, density);
  const halfBand = Math.floor((cols - 1) / 2);

  const gapFrom = synapseGap(fromRadius);
  const gapTo = synapseGap(toRadius);

  // Shaft spans from outer side of start cleft to outer side of end cleft:
  // attachment is on node rim; step out by gap to meet inner arc.
  // s=0 at `from` (start rim), s=length at `to` (end rim).
  const s0 = gapFrom;
  const s1 = length - gapTo;
  // Slight inset so last shaft cells kiss the first arc ring without a hole
  const join = cell * 0.15;
  const shaftStart = Math.max(0, s0 - join);
  const shaftEnd = Math.min(length, s1 + join);

  sampleShaft(
    graphics,
    from,
    ux,
    uy,
    shaftStart,
    shaftEnd,
    cell,
    halfBand,
    color,
    alpha,
    density,
    visual
  );

  // Rim on both ends — direction later via pulse animation
  drawRimArc(
    graphics,
    fromCenter,
    fromRadius,
    from,
    cell,
    color,
    alpha,
    density,
    visual
  );
  drawRimArc(
    graphics,
    toCenter,
    toRadius,
    to,
    cell,
    color,
    alpha,
    density,
    visual
  );
}

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

  drawEdgeBody(
    graphics,
    from,
    to,
    band,
    options.color,
    alpha,
    density,
    options.visual,
    options.fromCenter,
    options.fromRadius,
    options.toCenter,
    options.toRadius
  );
}

/** @deprecated Use drawEdge. */
export const drawArrow = drawEdge;
