/**
 * verify-mock-layout.mjs — mock graph shape + product paint layout loop.
 *
 * Product surface: createGraphPaintLoop paints mock; ranks preserved;
 * settle via settleGraphData (force-recipe subpath). Static engine / step() gone.
 *
 * Run: npm run verify:mock-layout
 *   → npx tsx scripts/verify-mock-layout.mjs
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
  if (typeof globalThis.requestAnimationFrame !== "function") {
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  const fixtureUrl = pathToFileURL(
    path.join(root, "src/lib/graph/fixtures/mock-graph.ts")
  ).href;
  const layoutUrl = pathToFileURL(
    path.join(root, "src/lib/graph/layout/layout-loop-d3.ts")
  ).href;
  const recipeUrl = pathToFileURL(
    path.join(root, "src/lib/graph/placement/force-recipe.ts")
  ).href;

  const { createMockGraphData } = await import(fixtureUrl);
  const layout = await import(layoutUrl);
  const { settleGraphData } = await import(recipeUrl);

  const { createGraphPaintLoop } = layout;

  assert(
    typeof createGraphPaintLoop === "function",
    "createGraphPaintLoop exported (product paint path)"
  );
  assert(
    typeof layout.createLayoutLoop === "undefined",
    "createLayoutLoop removed"
  );
  assert(
    typeof layout.createStaticLayoutLoop === "undefined",
    "createStaticLayoutLoop removed"
  );
  assert(
    typeof layout.createLayoutLoopAsync === "undefined",
    "createLayoutLoopAsync removed"
  );

  const g0 = createMockGraphData();
  assert(g0.nodes.length >= 2, `≥2 nodes (got ${g0.nodes.length})`);
  assert(g0.edges.length >= 1, `≥1 edge (got ${g0.edges.length})`);

  for (const n of g0.nodes) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), `initial finite ${n.id}`);
    assert(
      Math.abs(n.x) < 1e4 && Math.abs(n.y) < 1e4,
      `node ${n.id} stays local (x=${n.x}, y=${n.y})`
    );
  }

  for (const e of g0.edges) {
    const ids = new Set(g0.nodes.map((n) => n.id));
    assert(ids.has(e.source) && ids.has(e.target), `edge ${e.id} endpoints exist`);
    assert(
      e.type === "PART_OF" || e.type === "RELATES_TO",
      `edge ${e.id} has link type (got ${e.type})`
    );
  }

  for (const n of g0.nodes) {
    assert(typeof n.rank === "number" && n.rank >= 0, `node ${n.id} has rank ≥ 0`);
  }

  const initial = new Map(g0.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

  // Paint path: start paints initial graph; setGraphData paints without settle.
  let lastPaint = null;
  const loop = createGraphPaintLoop({
    graphData: g0,
    renderOnGraphData: (g) => {
      lastPaint = g;
    },
  });
  loop.start();
  assert(lastPaint != null, "start paints");
  loop.setGraphData(g0);
  assert(lastPaint.nodes.length === g0.nodes.length, "node count preserved on paint");

  let paintMoved = 0;
  for (const n of lastPaint.nodes) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), `finite after paint ${n.id}`);
    const prev = initial.get(n.id);
    if (prev && (n.x !== prev.x || n.y !== prev.y)) paintMoved += 1;
    const beforeRank = g0.nodes.find((p) => p.id === n.id)?.rank;
    assert(n.rank === beforeRank, `rank preserved for ${n.id}`);
  }
  assert(paintMoved === 0, `paint path does not settle (moved=${paintMoved})`);

  // Settle path (force-recipe): moves ≥1 node.
  const after = settleGraphData(g0, { ticks: 300 });
  let moved = 0;
  for (const n of after.nodes) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), `finite after settle ${n.id}`);
    const prev = initial.get(n.id);
    if (prev && (n.x !== prev.x || n.y !== prev.y)) moved += 1;
    const beforeRank = g0.nodes.find((p) => p.id === n.id)?.rank;
    assert(n.rank === beforeRank, `settle preserves rank for ${n.id}`);
  }
  assert(moved >= 1, `at least one node moved after d3 settle (moved=${moved})`);

  assert(typeof loop.setGraphData === "function", "handle exposes setGraphData");
  assert(typeof loop.getGraphData === "undefined", "handle has no getGraphData");
  assert(typeof loop.status === "undefined", "handle has no status");
  assert(typeof loop.step === "undefined", "handle has no step()");
  loop.stop();

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll mock-layout checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
