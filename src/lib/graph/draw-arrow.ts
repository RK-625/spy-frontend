/**
 * Screen-space directed arrows for Pixi Graphics.
 *
 * Pure geometry helpers + one draw path. Camera stays outside; callers pass
 * already-projected screen points. No stage.scale.
 */

import type { Graphics } from "pixi.js";

export type ScreenPoint = { x: number; y: number };

export type DrawArrowOptions = {
  width: number;
  color: number;
  alpha?: number;
  /** Arrowhead length in px; default ~ max(4, width * 5). */
  headLength?: number;
  /** If true, shaft is dash segments (Pixi has no native dash). */
  dashed?: boolean;
  dash?: number;
  gap?: number;
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

/**
 * Draw a shaft (solid or dashed) and a filled triangle head at `to`,
 * pointing along from→to. Strokes/fills immediately (Pixi v8 path style).
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
    dashed = false,
    dash = 6,
    gap = 4,
  } = options;
  const headLength = options.headLength ?? Math.max(4, width * 5);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 0.5) return;

  const ux = dx / length;
  const uy = dy / length;

  // Shaft ends at the base of the head so the tip is not under a thick stroke
  const shaftLength = Math.max(0, length - headLength);
  if (shaftLength > 0.5) {
    const shaftEnd: ScreenPoint = {
      x: from.x + ux * shaftLength,
      y: from.y + uy * shaftLength,
    };
    if (dashed) {
      appendDashedShaft(graphics, from, shaftEnd, dash, gap);
    } else {
      graphics.moveTo(from.x, from.y);
      graphics.lineTo(shaftEnd.x, shaftEnd.y);
    }
    graphics.stroke({ width, color, alpha });
  }

  const halfWidth = headLength * 0.4;
  const baseX = to.x - ux * headLength;
  const baseY = to.y - uy * headLength;
  const px = -uy * halfWidth;
  const py = ux * halfWidth;

  graphics.moveTo(to.x, to.y);
  graphics.lineTo(baseX + px, baseY + py);
  graphics.lineTo(baseX - px, baseY - py);
  graphics.closePath();
  graphics.fill({ color, alpha });
}
