// Spider frame data for canvas-based pixel art rendering.
// Each frame is a 32x32 grid. 0 = transparent, 1 = body, 2 = leg, 3 = accent.
export const FRAME_W = 32;
export const FRAME_H = 32;

export const COLORS: Record<number, string> = {
  1: "#1a1a2e", // body
  2: "#22223a", // legs (slightly lighter)
  3: "#c9952a", // accent (amber)
};

type Grid = number[][];

// Helper: create empty grid
function empty(): Grid {
  return Array.from({ length: FRAME_H }, () => Array(FRAME_W).fill(0));
}

// Helper: draw a line of pixels on the grid
function line(
  g: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number
) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  while (true) {
    if (y >= 0 && y < FRAME_H && x >= 0 && x < FRAME_W) g[y][x] = color;
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

// Helper: draw filled ellipse
function fillEllipse(
  g: Grid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number
) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.0) {
        const px = Math.round(cx + x);
        const py = Math.round(cy + y);
        if (py >= 0 && py < FRAME_H && px >= 0 && px < FRAME_W) {
          g[py][px] = color;
        }
      }
    }
  }
}

function buildSpider(
  legOffsetX: number,
  legOffsetY: number,
  bodyShift: number,
  waveAmount: number = 0
): Grid {
  const g = empty();

  // Cephalothorax (front body segment) — smaller oval
  fillEllipse(g, 16, 12 + bodyShift, 5, 3, 1);

  // Abdomen (back body segment) — larger oval
  fillEllipse(g, 16, 21 + bodyShift, 6, 5, 1);

  // Pedicel (connection between body segments)
  line(g, 15, 15 + bodyShift, 15, 17 + bodyShift, 1);
  line(g, 16, 15 + bodyShift, 16, 17 + bodyShift, 1);
  line(g, 17, 15 + bodyShift, 17, 17 + bodyShift, 1);

  // === LEGS ===
  // Front-left pair (forward-up)
  line(g, 12, 11 + bodyShift, 9 + legOffsetX, 7 + legOffsetY, 2);
  line(g, 9 + legOffsetX, 7 + legOffsetY, 6, 4 + legOffsetY, 2);

  // Front-right pair (forward-up) — This leg waves!
  line(g, 20, 11 + bodyShift, 23 - legOffsetX, 7 + legOffsetY - Math.floor(waveAmount / 2), 2);
  line(g, 23 - legOffsetX, 7 + legOffsetY - Math.floor(waveAmount / 2), 26, 4 + legOffsetY - waveAmount, 2);

  // Mid-front-left (sideways)
  line(g, 11, 13 + bodyShift, 7 + legOffsetX, 12, 2);
  line(g, 7 + legOffsetX, 12, 3, 11, 2);

  // Mid-front-right (sideways)
  line(g, 21, 13 + bodyShift, 25 - legOffsetX, 12, 2);
  line(g, 25 - legOffsetX, 12, 29, 11, 2);

  // Mid-back-left (sideways-down)
  line(g, 11, 19 + bodyShift, 7 + legOffsetX, 20, 2);
  line(g, 7 + legOffsetX, 20, 3, 21, 2);

  // Mid-back-right (sideways-down)
  line(g, 21, 19 + bodyShift, 25 - legOffsetX, 20, 2);
  line(g, 25 - legOffsetX, 20, 29, 21, 2);

  // Back-left (backward-down)
  line(g, 13, 24 + bodyShift, 10 + legOffsetX, 27 + legOffsetY, 2);
  line(g, 10 + legOffsetX, 27 + legOffsetY, 8, 30, 2);

  // Back-right (backward-down)
  line(g, 19, 24 + bodyShift, 22 - legOffsetX, 27 + legOffsetY, 2);
  line(g, 22 - legOffsetX, 27 + legOffsetY, 24, 30, 2);

  // === ACCENT — subtle stripe on abdomen ===
  line(g, 13, 21 + bodyShift, 19, 21 + bodyShift, 3);

  return g;
}

export const FRAMES: Grid[] = [
  // Frame 0: neutral
  buildSpider(0, 0, 0),
  // Frame 1: legs slightly outward, body shifts up 1px
  buildSpider(1, -1, -1),
  // Frame 2: legs slightly inward, body shifts down 1px
  buildSpider(-1, 0, 1),
  // Frame 3: legs slightly outward again, body back to center
  buildSpider(1, -1, 0),
];

// A dedicated sequence for a "hello" wave, lifting the front-right leg high
export const WAVE_FRAMES: Grid[] = [
  buildSpider(0, 0, 0, 0),   // idle
  buildSpider(0, 0, 1, 0),   // anticipation squash down
  buildSpider(0, 0, -1, 2),  // spring up, leg starts lifting
  buildSpider(0, 0, -1, 4),  // leg high
  buildSpider(0, 0, -1, 2),  // leg drops slightly
  buildSpider(0, 0, -1, 4),  // leg high again (the wave)
  buildSpider(0, 0, -1, 2),  // leg drops slightly
  buildSpider(0, 0, -1, 4),  // leg high again (the wave)
  buildSpider(0, 0, -1, 2),  // leg drops slightly
  buildSpider(0, 0, -1, 4),  // leg high again (the wave)
  buildSpider(0, 0, 0, 0),   // return to idle
];
