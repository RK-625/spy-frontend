/**
 * verify-node-size.mjs — pure rank × linear zoom (no node MIN/MAX) + edge width.
 *
 * Run: npm run verify:node-size
 *   → npx tsx scripts/verify-node-size.mjs
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

async function main() {
  const url = pathToFileURL(
    path.join(root, "src/lib/graph/pixi-renderer.ts")
  ).href;
  const mod = await import(url);
  const { nodeScreenRadius, edgeScreenWidth } = mod;

  const drawArrowUrl = pathToFileURL(
    path.join(root, "src/lib/graph/draw-arrow.ts")
  ).href;
  const drawArrowMod = await import(drawArrowUrl);
  const { insetSegment } = drawArrowMod;

  const BASE = 8;
  const Q = 0.8;
  const EDGE_BASE = 1;
  const EDGE_STROKE_MIN = 0.25;

  const r0z1 = nodeScreenRadius(0, 1);
  const r1z1 = nodeScreenRadius(1, 1);
  const r2z1 = nodeScreenRadius(2, 1);
  const r0z2 = nodeScreenRadius(0, 2);
  const r0zTiny = nodeScreenRadius(0, 0.1);
  const r2zTiny = nodeScreenRadius(2, 0.1);
  const r0zHuge = nodeScreenRadius(0, 1e6);
  const r2zHuge = nodeScreenRadius(2, 1e6);

  assert(r0z1 > r1z1 && r1z1 > r2z1, `rank0 > rank1 > rank2 at z1 (${r0z1} > ${r1z1} > ${r2z1})`);
  assert(r0z1 > r2z1, `rank0 > rank2 at zoom 1`);
  assert(r0zHuge > r2zHuge, `rank0 > rank2 at extreme zoom (${r0zHuge} > ${r2zHuge})`);
  assert(
    Math.abs(r0z2 - 2 * r0z1) < 1e-9,
    `linear zoom: rank0 z2 = 2× z1 (${r0z2} vs ${2 * r0z1})`
  );
  assert(Math.abs(r0z1 - BASE) < 1e-9, `rank0 zoom1 = BASE (${r0z1})`);
  assert(
    Math.abs(r1z1 / r0z1 - Q) < 1e-9,
    `ratio rank1/rank0 = Q (${r1z1 / r0z1})`
  );
  assert(
    Math.abs(r2z1 - BASE * Q ** 2) < 1e-9,
    `pure formula rank2 z1 (${r2z1})`
  );

  // Tiny zoom: sizes can be < 2; ratios still hold
  assert(r0zTiny < 2, `tiny zoom can be < 2px (got ${r0zTiny})`);
  assert(r0zTiny > r2zTiny, `tiny zoom still rank0 > rank2 (${r0zTiny} > ${r2zTiny})`);
  assert(
    Math.abs(r0zTiny - BASE * 0.1) < 1e-9,
    `pure formula rank0 z0.1 (${r0zTiny})`
  );

  assert(
    Math.abs(nodeScreenRadius(0, NaN) - r0z1) < 1e-9,
    "NaN zoom falls back to |z|=1"
  );
  assert(
    Math.abs(nodeScreenRadius(0, 0) - r0z1) < 1e-9,
    "zero zoom falls back to |z|=1"
  );

  // --- Edges: linear zoom + stroke safety floor (native solid only) ---
  const e1 = edgeScreenWidth(1);
  const e2 = edgeScreenWidth(2);
  const eTiny = edgeScreenWidth(0.01);
  assert(Math.abs(e1 - EDGE_BASE) < 1e-9, `edge zoom1 = EDGE_BASE (${e1})`);
  assert(Math.abs(e2 - 2 * e1) < 1e-9, `edge width doubles with zoom (${e2} vs ${2 * e1})`);
  assert(eTiny >= EDGE_STROKE_MIN, `edge safety floor at tiny zoom (${eTiny})`);
  assert(
    Math.abs(edgeScreenWidth(NaN) - e1) < 1e-9,
    "edge NaN zoom falls back to 1"
  );

  // --- insetSegment (arrow endpoint padding) ---
  const inset = insetSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 10);
  assert(inset !== null, "insetSegment returns segment for long enough line");
  assert(Math.abs(inset.start.x - 10) < 1e-9, `inset start.x=10 (got ${inset.start.x})`);
  assert(Math.abs(inset.end.x - 90) < 1e-9, `inset end.x=90 (got ${inset.end.x})`);
  assert(
    insetSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, 6, 6) === null,
    "insetSegment null when too short"
  );

  // --- RELATES_TO width scale token ---
  const styleUrl = pathToFileURL(
    path.join(root, "src/lib/graph/graph-style.ts")
  ).href;
  const style = await import(styleUrl);
  assert(
    style.GRAPH_EDGE_RELATES_WIDTH_SCALE === 0.75,
    `RELATES width scale 0.75 (got ${style.GRAPH_EDGE_RELATES_WIDTH_SCALE})`
  );
  const relatesW = e1 * style.GRAPH_EDGE_RELATES_WIDTH_SCALE;
  assert(
    Math.abs(relatesW - 0.75) < 1e-9,
    `relates width at zoom1 = 0.75 (got ${relatesW})`
  );

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll node-size / edge-width checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
