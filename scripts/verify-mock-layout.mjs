/**
 * verify-mock-layout.mjs — mock graph + static / d3-settle layout loops.
 *
 * FA2 / graphology path removed (Slice 7). Retargeted to static freeze +
 * one-shot d3 settle (same exit idea: settle moves ≥1 node; static does not).
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

  const graphDataUrl = pathToFileURL(
    path.join(root, "src/lib/graph/graph-data.ts")
  ).href;
  const layoutUrl = pathToFileURL(
    path.join(root, "src/lib/graph/layout-loop.ts")
  ).href;

  const graphDataModule = await import(graphDataUrl);
  const layout = await import(layoutUrl);

  const { createMockGraphData } = graphDataModule;
  const { createLayoutLoop, createLayoutLoopAsync } = layout;

  // Engines are static | d3-settle only (FA2 soft-switch removed).
  assert(
    typeof createLayoutLoop === "function",
    "createLayoutLoop exported (static product path)"
  );
  assert(
    typeof createLayoutLoopAsync === "function",
    "createLayoutLoopAsync exported for d3 settle path"
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

  // Default async path is static (no layoutEngine → no force).
  const defaultAsync = await createLayoutLoopAsync({
    graphData: createMockGraphData(),
  });
  const beforeDefault = defaultAsync.getGraphData();
  defaultAsync.start();
  defaultAsync.step();
  const afterDefault = defaultAsync.getGraphData();
  let defaultMoved = 0;
  for (const n of afterDefault.nodes) {
    const prev = beforeDefault.nodes.find((p) => p.id === n.id);
    if (prev && (n.x !== prev.x || n.y !== prev.y)) defaultMoved += 1;
  }
  assert(
    defaultMoved === 0,
    `default layoutEngine is static (moved=${defaultMoved})`
  );
  defaultAsync.stop();

  // d3-settle moves ≥1 node
  const loop = await createLayoutLoopAsync({
    graphData: g0,
    layoutEngine: "d3-settle",
  });
  loop.start();

  const after = loop.getGraphData();
  assert(after.nodes.length === g0.nodes.length, "node count preserved");

  let moved = 0;
  for (const n of after.nodes) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), `finite after layout ${n.id}`);
    const prev = initial.get(n.id);
    if (prev && (n.x !== prev.x || n.y !== prev.y)) moved += 1;
    const beforeRank = g0.nodes.find((p) => p.id === n.id)?.rank;
    assert(n.rank === beforeRank, `rank preserved for ${n.id}`);
  }
  assert(moved >= 1, `at least one node moved after d3 settle (moved=${moved})`);

  // Soft-disabled / static path: positions must not change
  const staticLoop = createLayoutLoop({
    graphData: createMockGraphData(),
  });
  const beforeStatic = staticLoop.getGraphData();
  staticLoop.start();
  staticLoop.step();
  const afterStatic = staticLoop.getGraphData();
  let staticMoved = 0;
  for (const n of afterStatic.nodes) {
    const prev = beforeStatic.nodes.find((p) => p.id === n.id);
    if (prev && (n.x !== prev.x || n.y !== prev.y)) staticMoved += 1;
  }
  assert(staticMoved === 0, `static layout keeps positions (moved=${staticMoved})`);

  assert(typeof loop.getGraphData === "function", "handle exposes getGraphData");
  assert(typeof loop.setGraphData === "function", "handle exposes setGraphData");
  loop.stop();
  assert(loop.status() === "stopped", "status stopped");

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
