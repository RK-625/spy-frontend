/**
 * verify-d3-layout.mjs — Slice 1: one-shot d3 settle layout loop vs static.
 *
 * Run: npm run verify:d3-layout
 *   → npx tsx scripts/verify-d3-layout.mjs
 *
 * Exit criteria (plans/d3-force-placement-slices.md S1):
 *   - settle moves ≥1 node vs static frozen path
 *   - positions finite; ranks preserved
 *   - createLayoutLoop rejects d3-settle sync (forces async dynamic import)
 *   - default layout-loop source still avoids static force-recipe / d3-force imports
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

  const graphDataUrl = pathToFileURL(
    path.join(root, "src/lib/graph/graph-data.ts")
  ).href;
  const layoutUrl = pathToFileURL(
    path.join(root, "src/lib/graph/layout-loop.ts")
  ).href;

  const { createMockGraphData } = await import(graphDataUrl);
  const { createLayoutLoop, createLayoutLoopAsync } = await import(layoutUrl);

  // Engines are static | d3-settle only (no continuous-sim soft-switch).
  assert(
    typeof createLayoutLoop === "function" &&
      typeof createLayoutLoopAsync === "function",
    "layout-loop exports static + async d3-settle entry points"
  );

  const mock = createMockGraphData();
  const frozen = new Map(mock.nodes.map((n) => [n.id, { x: n.x, y: n.y, rank: n.rank }]));

  // Sync path must reject d3-settle (dynamic import required).
  let threw = false;
  try {
    createLayoutLoop({
      graphData: createMockGraphData(),
      layoutEngine: "d3-settle",
    });
  } catch (err) {
    threw = true;
    assert(
      String(err?.message ?? err).includes("createLayoutLoopAsync"),
      "sync createLayoutLoop error mentions createLayoutLoopAsync"
    );
  }
  assert(threw, "createLayoutLoop throws for layoutEngine d3-settle");

  // Static path: positions unchanged after start.
  const staticLoop = createLayoutLoop({
    graphData: createMockGraphData(),
  });
  staticLoop.start();
  const staticAfter = staticLoop.getGraphData();
  let staticMoved = 0;
  for (const n of staticAfter.nodes) {
    const f = frozen.get(n.id);
    if (!f) continue;
    if (f.x !== n.x || f.y !== n.y) staticMoved += 1;
  }
  assert(staticMoved === 0, `static path moves 0 nodes (got ${staticMoved})`);
  staticLoop.stop();

  // d3-settle path: ≥1 node moves; all finite; ranks preserved.
  let dirtyEmits = 0;
  const d3Loop = await createLayoutLoopAsync({
    graphData: createMockGraphData(),
    layoutEngine: "d3-settle",
    renderOnGraphData: (_g, opts) => {
      if (opts?.movedNodeIds != null || opts?.dirtyEdges != null) {
        dirtyEmits += 1;
      }
    },
  });
  d3Loop.start();
  const settled = d3Loop.getGraphData();

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

  // setGraphData should emit dirty opts when positions change.
  d3Loop.setGraphData(createMockGraphData());
  assert(dirtyEmits >= 1, `setGraphData emitted dirty opts (got ${dirtyEmits})`);

  d3Loop.stop();

  // Import guard: dispatcher must not statically import recipe / d3-force.
  const layoutLoopSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/layout-loop.ts"),
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
    canvasSrc.includes('get("layout") === "d3"'),
    "graph-canvas reads layout=d3 opt-in"
  );
  assert(
    canvasSrc.includes('get("motion") === "1"'),
    "graph-canvas reads motion=1 ambient opt-in (S8)"
  );
  assert(
    canvasSrc.includes("ambientMotion: wantMotion"),
    "graph-canvas passes ambientMotion (default off unless motion=1)"
  );

  // Ambient default off: d3-settle without ambientMotion stops after settle.
  const ambientOff = await createLayoutLoopAsync({
    graphData: createMockGraphData(),
    layoutEngine: "d3-settle",
    ambientMotion: false,
  });
  ambientOff.start();
  assert(
    ambientOff.status() === "stopped",
    "ambientMotion false → status stopped after start (no continuous loop)"
  );
  ambientOff.stop();

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
