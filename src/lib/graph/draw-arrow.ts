/**
 * Screen-space directed edges for Pixi Graphics.
 *
 * Shaft: solid | dots | dash. Head: pixel (default) | triangle.
 * Camera stays outside; callers pass already-projected screen points.
 */

import type { Graphics } from "pixi.js";

export type ScreenPoint = { x: number; y: number };

export type ArrowShaftStyle = "solid" | "dots" | "dash";
export type ArrowHeadStyle = "pixel" | "triangle";

export type DrawArrowOptions = {
  width: number;
  color: number;
  alpha?: number;
  /** Arrowhead span along the shaft; default ~ max(5, width * 5). */
  headLength?: number;
  /** Shaft style. Prefer over legacy `dashed`. */
  shaft?: ArrowShaftStyle;
  /**
   * @deprecated Prefer `shaft: "dash"`. Still honored when `shaft` is omitted.
   */
  dashed?: boolean;
  dash?: number;
  gap?: number;
  /** Spacing for shaft "dots"; default ~ max(4, width * 4). */
  dotPitch?: number;
  /** Radius of each shaft dot; default ~ max(0.75, width * 0.55). */
  dotRadius?: number;
  headStyle?: ArrowHeadStyle;
};

/**
 * Shorten a segment by endpoint insets (e.g. node radii).
 * Returns null when the remaining shaft is too short to draw.
 */
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

function resolveShaft(options: DrawArrowOptions): ArrowShaftStyle {
  if (options.shaft !== undefined) return options.shaft;
  if (options.dashed) return "dash";
  return "solid";
}

/** Dash segments along from→to via moveTo/lineTo (no stroke yet). */
function appendDashedShaft(
  graphics: Graphics,
  from: ScreenPoint,
  to: ScreenPoint,
  dash: number,
  gap: number
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-6) return;

  const ux = dx / length;
  const uy = dy / length;
  const dashLen = Math.max(0.5, dash);
  const gapLen = Math.max(0, gap);

  let distance = 0;
  let drawing = true;
  while (distance < length) {
    const step = drawing ? dashLen : gapLen;
    const next = Math.min(length, distance + step);
    if (drawing && next > distance) {
      graphics.moveTo(from.x + ux * distance, from.y + uy * distance);
      graphics.lineTo(from.x + ux * next, from.y + uy * next);
    }
    distance = next;
    drawing = !drawing;
  }
}

/** Dot train along from→to — filled circles at pitch (not railroad dashes). */
function drawDotShaft(
  graphics: Graphics,
  from: ScreenPoint,
  to: ScreenPoint,
  pitch: number,
  radius: number,
  color: number,
  alpha: number
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-6) return;

  const ux = dx / length;
  const uy = dy / length;
  const step = Math.max(1.5, pitch);
  const r = Math.max(0.4, radius);

  // Start slightly inset so the first dot is not under the node rim
  let distance = Math.min(step * 0.35, length * 0.5);
  while (distance <= length) {
    const x = from.x + ux * distance;
    const y = from.y + uy * distance;
    graphics.circle(x, y, r);
    graphics.fill({ color, alpha });
    distance += step;
  }
}

/**
 * Pixel chevron head: local grid offsets rotated into screen space.
 * Rows step back from the tip along -forward; lateral steps use perpendicular.
 *
 * Pattern (tip at end of shaft, pointing +forward):
 *   row0: center
 *   row1: left, right
 *   row2: farther left, farther right (optional density)
 */
function drawPixelHead(
  graphics: Graphics,
  tip: ScreenPoint,
  ux: number,
  uy: number,
  headLength: number,
  color: number,
  alpha: number
): void {
  const cell = Math.max(1.2, headLength / 4);
  const px = -uy;
  const py = ux;
  const r = Math.max(0.55, cell * 0.42);

  // Local (along, lateral) in cells: tip is (0,0), body extends backward
  const cells: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [1, -1],
    [1, 1],
    [2, -1.5],
    [2, 1.5],
    [2, 0],
  ];

  for (const [back, lateral] of cells) {
    const x = tip.x - ux * back * cell + px * lateral * cell;
    const y = tip.y - uy * back * cell + py * lateral * cell;
    graphics.circle(x, y, r);
    graphics.fill({ color, alpha });
  }
}

function drawTriangleHead(
  graphics: Graphics,
  tip: ScreenPoint,
  ux: number,
  uy: number,
  headLength: number,
  color: number,
  alpha: number
): void {
  const halfWidth = headLength * 0.4;
  const baseX = tip.x - ux * headLength;
  const baseY = tip.y - uy * headLength;
  const px = -uy * halfWidth;
  const py = ux * halfWidth;

  graphics.moveTo(tip.x, tip.y);
  graphics.lineTo(baseX + px, baseY + py);
  graphics.lineTo(baseX - px, baseY - py);
  graphics.closePath();
  graphics.fill({ color, alpha });
}

/**
 * Draw a directed edge: shaft (solid / dots / dash) + head (pixel / triangle).
 * Strokes/fills immediately (Pixi v8 path style).
 */
export function drawArrow(
  graphics: Graphics,
  from: ScreenPoint,
  to: ScreenPoint,
  options: DrawArrowOptions
): void {
  const {
    width,
    color,
    alpha = 1,
    dash = 6,
    gap = 4,
  } = options;
  const shaft = resolveShaft(options);
  const headStyle: ArrowHeadStyle = options.headStyle ?? "pixel";
  const headLength = options.headLength ?? Math.max(5, width * 5);
  const dotPitch = options.dotPitch ?? Math.max(4, width * 4);
  const dotRadius = options.dotRadius ?? Math.max(0.75, width * 0.55);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 0.5) return;

  const ux = dx / length;
  const uy = dy / length;

  // Shaft ends short of the tip so the head sits cleanly at `to`
  const shaftLength = Math.max(0, length - headLength);
  if (shaftLength > 0.5) {
    const shaftEnd: ScreenPoint = {
      x: from.x + ux * shaftLength,
      y: from.y + uy * shaftLength,
    };

    if (shaft === "dots") {
      drawDotShaft(
        graphics,
        from,
        shaftEnd,
        dotPitch,
        dotRadius,
        color,
        alpha
      );
    } else if (shaft === "dash") {
      appendDashedShaft(graphics, from, shaftEnd, dash, gap);
      graphics.stroke({ width, color, alpha });
    } else {
      graphics.moveTo(from.x, from.y);
      graphics.lineTo(shaftEnd.x, shaftEnd.y);
      graphics.stroke({ width, color, alpha });
    }
  }

  if (headStyle === "triangle") {
    drawTriangleHead(graphics, to, ux, uy, headLength, color, alpha);
  } else {
    drawPixelHead(graphics, to, ux, uy, headLength, color, alpha);
  }
}
