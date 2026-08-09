/**
 * verify-d3-layout.mjs — product paint layout store + canvas wiring.
 *
 * Run: npm run verify:d3-layout
 *   → npx tsx scripts/verify-d3-layout.mjs
 *
 * Product surface:
 *   createGraphPaintLoop({ graphData, renderOnGraphData })
 *     → setGraph / stop (paint only; no settle option)
 *
 * Settle is placeTopology / settleGraphData (force-recipe subpath).
 */

import fs from "node:fs";
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
  const loopUrl = pathToFileURL(
    path.join(root, "src/lib/graph/layout/layout-loop-d3.ts")
  ).href;
  const recipeUrl = pathToFileURL(
    path.join(root, "src/lib/graph/placement/force-recipe.ts")
  ).href;

  const { createMockGraphData } = await import(fixtureUrl);
  const { createGraphPaintLoop } = await import(loopUrl);
  const { settleGraphData } = await import(recipeUrl);

  assert(
    typeof createGraphPaintLoop === "function",
    "createGraphPaintLoop exported (product paint entry)"
  );
  assert(
    !fs.existsSync(path.join(root, "src/lib/graph/layout/layout-loop.ts")),
    "layout-loop.ts thin wrapper deleted"
  );

  const mock = createMockGraphData();
  const frozen = new Map(
    mock.nodes.map((n) => [n.id, { x: n.x, y: n.y, rank: n.rank }])
  );

  let paintEmits = 0;
  let lastPaint = null;
  const d3Loop = createGraphPaintLoop({
    graphData: createMockGraphData(),
    renderOnGraphData: (g) => {
      paintEmits += 1;
      lastPaint = g;
    },
  });
  // setGraph is paint-only (product placeTopology owns settle).
  const mockAgain = createMockGraphData();
  const mockXY = new Map(mockAgain.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  d3Loop.setGraph(mockAgain);
  const painted = lastPaint;
  assert(paintEmits >= 1, `setGraph paints full graph (paintEmits=${paintEmits})`);

  let defaultMoved = 0;
  for (const n of painted.nodes) {
    assert(
      Number.isFinite(n.x) && Number.isFinite(n.y),
      `finite after setGraph paint ${n.id}`
    );
    const f = frozen.get(n.id);
    assert(f != null, `known node ${n.id}`);
    assert(f.rank === n.rank, `rank preserved ${n.id}`);
    const m = mockXY.get(n.id);
    if (m && (m.x !== n.x || m.y !== n.y)) defaultMoved += 1;
  }
  assert(
    defaultMoved === 0,
    `setGraph does not settle (moved=${defaultMoved})`
  );

  // settle lives in force-recipe (moves ≥1 node vs mock).
  const settled = settleGraphData(createMockGraphData(), { ticks: 300 });
  let moved = 0;
  for (const n of settled.nodes) {
    assert(
      Number.isFinite(n.x) && Number.isFinite(n.y),
      `finite after d3 settle ${n.id}`
    );
    const f = frozen.get(n.id);
    assert(f != null, `known node ${n.id}`);
    assert(f.rank === n.rank, `rank preserved ${n.id}`);
    if (f.x !== n.x || f.y !== n.y) moved += 1;
  }
  assert(moved >= 1, `settleGraphData moves ≥1 node vs mock (got ${moved})`);
  console.log(`  moved ${moved} / ${settled.nodes.length} nodes`);

  // paint store re-install keeps positions.
  let paintCount = 0;
  let baselinePaint = null;
  const noSettleLoop = createGraphPaintLoop({
    graphData: painted,
    renderOnGraphData: (g) => {
      paintCount += 1;
      baselinePaint = g;
    },
  });
  noSettleLoop.setGraph(painted);
  const baselineXY = new Map(
    baselinePaint.nodes.map((n) => [n.id, { x: n.x, y: n.y }])
  );
  paintCount = 0;
  noSettleLoop.setGraph(baselinePaint);
  let noSettleMoved = 0;
  for (const n of baselinePaint.nodes) {
    const p = baselineXY.get(n.id);
    if (p && (p.x !== n.x || p.y !== n.y)) noSettleMoved += 1;
  }
  assert(noSettleMoved === 0, `re-paint keeps positions (moved=${noSettleMoved})`);
  assert(paintCount >= 1, `setGraph still paints (paintCount=${paintCount})`);
  noSettleLoop.stop();
  d3Loop.stop();

  const layoutD3Src = fs.readFileSync(
    path.join(root, "src/lib/graph/layout/layout-loop-d3.ts"),
    "utf8"
  );
  assert(
    !/from\s+["']d3-force["']/.test(layoutD3Src) &&
      !/from\s+["'][^"']*force-recipe["']/.test(layoutD3Src),
    "layout-loop-d3 does not import d3-force / force-recipe"
  );
  assert(
    !/\bambientMotion\b/.test(layoutD3Src) &&
      !/\bAMBIENT_/.test(layoutD3Src) &&
      !/\bstep\s*\(/.test(layoutD3Src) &&
      !/settle\s*\?/.test(layoutD3Src) &&
      !/\bgetGraphData\b/.test(layoutD3Src),
    "layout-loop-d3 has no ambient / step / settle option / getGraphData"
  );

  const canvasSrc = fs.readFileSync(
    path.join(root, "src/components/graph/graph-canvas.tsx"),
    "utf8"
  );
  assert(
    !/from\s+["'][^"']*force-recipe["']/.test(canvasSrc) &&
      !/from\s+["']d3-force["']/.test(canvasSrc),
    "graph-canvas does not statically import d3-force / force-recipe"
  );
  assert(
    canvasSrc.includes("layout-loop-d3") &&
      canvasSrc.includes("createGraphPaintLoop"),
    "graph-canvas dynamic-imports layout-loop-d3"
  );
  assert(
    !canvasSrc.includes("createLayoutLoopAsync"),
    "graph-canvas does not use createLayoutLoopAsync"
  );
  assert(
    !canvasSrc.includes("ambientMotion"),
    "graph-canvas does not pass ambientMotion"
  );
  assert(
    !canvasSrc.includes("layoutEngine"),
    "graph-canvas does not pass layoutEngine"
  );
  assert(
    canvasSrc.includes('fetch("/api/graph")'),
    "graph-canvas always fetches live /api/graph"
  );
  assert(
    canvasSrc.includes("placeTopology"),
    "graph-canvas maps live topology via placeTopology"
  );
  assert(
    canvasSrc.includes("setGraph(graph)") &&
      !canvasSrc.includes("settle:") &&
      !canvasSrc.includes("needsLayout") &&
      !canvasSrc.includes("Array.isArray"),
    "graph-canvas uses setGraph(graph) only; trusts GraphApiResponse"
  );
  assert(
    !canvasSrc.includes("layoutLoop.start") &&
      !canvasSrc.includes("layoutLoop.setGraphData"),
    "graph-canvas paint loop uses setGraph (no start / setGraphData)"
  );
  assert(
    !canvasSrc.includes("createMockGraphData") &&
      !canvasSrc.includes("createLargeStressGraphData") &&
      !canvasSrc.includes("initialGraphFromSearch"),
    "graph-canvas has no mock/stress product path"
  );
  assert(
    !canvasSrc.includes("URLSearchParams") &&
      !canvasSrc.includes("location.search") &&
      !canvasSrc.includes('get("layout")'),
    "graph-canvas does not parse product URL query params"
  );
  assert(
    !canvasSrc.includes("settleIfNeeded"),
    "graph-canvas dirty host / static settleIfNeeded path unplugged"
  );

  const barrelSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/index.ts"),
    "utf8"
  );
  assert(
    !/\bcreateLayoutLoopAsync\b/.test(barrelSrc) &&
      !/\bsettleGraphData\b/.test(barrelSrc) &&
      !/\bbuildForceSimulation\b/.test(barrelSrc) &&
      !/\bderiveRanks\b/.test(barrelSrc),
    "product barrel does not export force settle / layout async wrapper / deriveRanks"
  );
  assert(
    /\bplaceTopology\b/.test(barrelSrc) &&
      /\bLayoutLoopHandle\b/.test(barrelSrc),
    "product barrel exports placeTopology + layout paint types"
  );

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nverify:d3-layout passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
