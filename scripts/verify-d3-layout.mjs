/**
 * verify-d3-layout.mjs — product-only one-shot d3 settle layout loop.
 *
 * Run: npm run verify:d3-layout
 *   → npx tsx scripts/verify-d3-layout.mjs
 *
 * Product surface:
 *   createLayoutLoopAsync({ graphData, renderOnGraphData })
 *     → dynamic import layout-loop-d3
 *     → createD3SettleLayoutLoop
 *
 * Checks: settle moves ≥1 node; finite positions; ranks preserved;
 * setGraphData dirty opts; import guards; live-only canvas wiring;
 * status stopped after start.
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

  const dataUrl = pathToFileURL(
    path.join(root, "src/lib/graph/core/graph-data.ts")
  ).href;
  const loopUrl = pathToFileURL(
    path.join(root, "src/lib/graph/layout/layout-loop.ts")
  ).href;

  const { createMockGraphData } = await import(dataUrl);
  const layout = await import(loopUrl);
  const { createLayoutLoopAsync } = layout;

  assert(
    typeof createLayoutLoopAsync === "function",
    "createLayoutLoopAsync exported (product entry)"
  );
  assert(
    typeof layout.createLayoutLoop === "undefined",
    "createLayoutLoop removed (sync static factory gone)"
  );
  assert(
    typeof layout.createStaticLayoutLoop === "undefined",
    "createStaticLayoutLoop removed"
  );

  const mock = createMockGraphData();
  const frozen = new Map(
    mock.nodes.map((n) => [n.id, { x: n.x, y: n.y, rank: n.rank }])
  );

  // start() paints seed without settle; setGraphData settles.
  let paintEmits = 0;
  const d3Loop = await createLayoutLoopAsync({
    graphData: createMockGraphData(),
    renderOnGraphData: () => {
      paintEmits += 1;
    },
  });
  d3Loop.start();
  assert(
    d3Loop.status() === "stopped",
    "status() === stopped after start (product always stops)"
  );
  assert(paintEmits >= 1, `start paints full graph (paintEmits=${paintEmits})`);

  // start() is paint-only — seed positions unchanged.
  const afterStart = d3Loop.getGraphData();
  let startMoved = 0;
  for (const n of afterStart.nodes) {
    const f = frozen.get(n.id);
    if (f && (f.x !== n.x || f.y !== n.y)) startMoved += 1;
  }
  assert(startMoved === 0, `start() does not settle (moved=${startMoved})`);

  // setGraphData (default settle) moves ≥1 node; finite; ranks preserved.
  paintEmits = 0;
  d3Loop.setGraphData(createMockGraphData());
  const settled = d3Loop.getGraphData();
  assert(paintEmits >= 1, `setGraphData paints full graph (paintEmits=${paintEmits})`);
  assert(
    d3Loop.status() === "stopped",
    "status() === stopped after setGraphData"
  );

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
  assert(moved >= 1, `d3 settle moves ≥1 node vs mock (got ${moved})`);
  console.log(`  moved ${moved} / ${settled.nodes.length} nodes`);

  // settle: false installs without re-running force (positions unchanged + still paints).
  let paintCount = 0;
  const noSettleLoop = await createLayoutLoopAsync({
    graphData: d3Loop.getGraphData(),
    renderOnGraphData: () => {
      paintCount += 1;
    },
  });
  noSettleLoop.start(); // paint seed only
  const baseline = noSettleLoop.getGraphData();
  const baselineXY = new Map(baseline.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  paintCount = 0;
  noSettleLoop.setGraphData(baseline, { settle: false });
  const noSettleAfter = noSettleLoop.getGraphData();
  let noSettleMoved = 0;
  for (const n of noSettleAfter.nodes) {
    const p = baselineXY.get(n.id);
    if (p && (p.x !== n.x || p.y !== n.y)) noSettleMoved += 1;
  }
  assert(noSettleMoved === 0, `settle:false keeps positions (moved=${noSettleMoved})`);
  assert(paintCount >= 1, `settle:false still paints (paintCount=${paintCount})`);
  noSettleLoop.stop();
  d3Loop.stop();

  // Import guard: dispatcher must not statically import recipe / d3-force.
  const layoutLoopSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/layout/layout-loop.ts"),
    "utf8"
  );
  assert(
    !/from\s+["']d3-force["']/.test(layoutLoopSrc) &&
      !/from\s+["'][^"']*force-recipe["']/.test(layoutLoopSrc),
    "layout-loop.ts does not statically import d3-force / force-recipe"
  );
  assert(
    layoutLoopSrc.includes("layout-loop-d3"),
    "layout-loop.ts dynamic-imports layout-loop-d3"
  );
  assert(
    !layoutLoopSrc.includes("createStaticLayoutLoop") &&
      !layoutLoopSrc.includes("createLayoutLoop(") &&
      !/\blayoutEngine\b/.test(layoutLoopSrc) &&
      !/\bambientMotion\b/.test(layoutLoopSrc) &&
      !/\bstep\s*[:(]/.test(layoutLoopSrc),
    "layout-loop.ts has no static engine / ambient / step surface"
  );

  const layoutD3Src = fs.readFileSync(
    path.join(root, "src/lib/graph/layout/layout-loop-d3.ts"),
    "utf8"
  );
  assert(
    !/\bambientMotion\b/.test(layoutD3Src) &&
      !/\bAMBIENT_/.test(layoutD3Src) &&
      !/\bstep\s*\(/.test(layoutD3Src),
    "layout-loop-d3.ts has no ambient stack / step()"
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
    canvasSrc.includes("createLayoutLoopAsync"),
    "graph-canvas uses createLayoutLoopAsync"
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
    canvasSrc.includes("memoryGraphToGraphDataWithMeta"),
    "graph-canvas maps live topology via memoryGraphToGraphDataWithMeta"
  );
  assert(
    canvasSrc.includes("settle: needsLayout") ||
      canvasSrc.includes("setGraphData(graph, { settle: needsLayout })"),
    "graph-canvas uses setGraphData(graph, { settle: needsLayout })"
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
      !canvasSrc.includes('get("layout")') &&
      !canvasSrc.includes('get("motion")') &&
      !canvasSrc.includes('get("source")') &&
      !canvasSrc.includes('get("stress")') &&
      !canvasSrc.includes('params.has("stress")'),
    "graph-canvas does not parse product URL query params"
  );
  assert(
    !canvasSrc.includes("diffGraphDirty") &&
      !canvasSrc.includes("settleIfNeeded"),
    "graph-canvas dirty host / static settleIfNeeded path unplugged"
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
