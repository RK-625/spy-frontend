/**
 * verify-node-size.mjs — pure linear zoom + rank-symmetric edge band.
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
  const scaleUrl = pathToFileURL(
    path.join(root, "src/lib/graph/graph-scale.ts")
  ).href;
  const scale = await import(scaleUrl);
  const {
    NODE_BASE_PX,
    NODE_RANK_Q,
    EDGE_BASE_CELL,
    EDGE_BASE_BAND,
    EDGE_COLS_FIRM,
    EDGE_COLS_SOFT,
    EDGE_RELATES_WIDTH_SCALE,
    nodeScreenRadius,
    edgeCellSize,
    edgeBandWidth,
    edgeRankFactor,
    edgeColumnCount,
    edgeStripLayout,
    usableZoom,
  } = scale;

  const drawArrowUrl = pathToFileURL(
    path.join(root, "src/lib/graph/draw-arrow.ts")
  ).href;
  const { insetSegment } = await import(drawArrowUrl);

  // --- Nodes: pure linear zoom ---
  const r0z1 = nodeScreenRadius(0, 1);
  const r0z2 = nodeScreenRadius(0, 2);
  const r1z1 = nodeScreenRadius(1, 1);
  assert(Math.abs(r0z1 - NODE_BASE_PX) < 1e-9, `rank0 z1 = BASE (${r0z1})`);
  assert(
    Math.abs(r0z2 / r0z1 - 2) < 1e-9,
    `node r(z=2)/r(z=1) === 2 (got ${r0z2 / r0z1})`
  );
  assert(Math.abs(r1z1 / r0z1 - NODE_RANK_Q) < 1e-9, `node Q ladder`);
  assert(usableZoom(NaN) === 1 && usableZoom(0) === 1, `usableZoom guards`);

  // --- Cell: pure linear (no max clamp) ---
  const c1 = edgeCellSize(1);
  const c2 = edgeCellSize(2);
  const cHuge = edgeCellSize(1e6);
  assert(Math.abs(c1 - EDGE_BASE_CELL) < 1e-9, `cell(1) = BASE_CELL`);
  assert(
    Math.abs(c2 / c1 - 2) < 1e-9,
    `cell(2)/cell(1) === 2 (got ${c2 / c1})`
  );
  assert(
    Math.abs(cHuge - EDGE_BASE_CELL * 1e6) < 1e-3,
    `cell huge stays linear (no max clamp)`
  );

  // --- Rank factor rules ---
  assert(
    edgeRankFactor("part_of", 2, 0) === 0,
    `PART_OF uses parent (target) rank only`
  );
  assert(
    edgeRankFactor("relates", 3, 1) === 1,
    `RELATES uses min(source, target)`
  );

  // --- Band: pure linear + Q^rankFactor ---
  const bandP0 = edgeBandWidth(1, "part_of", 1, 0);
  const bandP1 = edgeBandWidth(1, "part_of", 2, 1);
  assert(
    Math.abs(bandP0 - EDGE_BASE_BAND) < 1e-9,
    `part_of parent0 z1 = BASE_BAND (${bandP0})`
  );
  assert(
    Math.abs(bandP0 / bandP1 - 1 / NODE_RANK_Q) < 1e-9,
    `band(parent0)/band(parent1) === 1/Q (got ${bandP0 / bandP1})`
  );
  assert(
    Math.abs(edgeBandWidth(2, "part_of", 1, 0) / bandP0 - 2) < 1e-9,
    `band linear zoom: z2/z1 === 2`
  );

  const bandR0 = edgeBandWidth(1, "relates", 0, 0);
  assert(
    Math.abs(bandR0 - EDGE_BASE_BAND * EDGE_RELATES_WIDTH_SCALE) < 1e-9,
    `relates rank0 = BASE_BAND * 0.75`
  );
  assert(bandR0 < bandP0, `relates thinner than part_of at same rank factor`);

  // --- Target cols + cell = band/cols ---
  assert(edgeColumnCount(1, 1, "firm") === EDGE_COLS_FIRM, `firm cols = 10`);
  assert(edgeColumnCount(1, 1, "soft") === EDGE_COLS_SOFT, `soft cols = 7`);
  const layoutFirm = edgeStripLayout(bandP0, "firm");
  assert(layoutFirm.cols === EDGE_COLS_FIRM, `strip firm cols 10`);
  assert(
    Math.abs(layoutFirm.cell * layoutFirm.cols - bandP0) < 1e-9,
    `cell * cols === band (drawn width tracks band)`
  );
  const layoutSoft = edgeStripLayout(bandR0, "soft");
  assert(layoutSoft.cols === EDGE_COLS_SOFT, `strip soft cols 7`);
  assert(layoutFirm.cell < bandP0 / 5, `firm cells smaller than old 5-col grain`);

  // --- insetSegment ---
  const inset = insetSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 10);
  assert(inset !== null && Math.abs(inset.start.x - 10) < 1e-9, `inset ok`);

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll scale-law checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
