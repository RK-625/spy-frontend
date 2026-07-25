/**
 * verify-mock-layout.mjs — nearby mock graph + FA2 layout loop.
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
  // Node has no DOM rAF. Layout sim start() uses it in the browser; tests
  // mostly use step(). Polyfill only here so layout-loop stays free of typeof guards.
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

  const g0 = createMockGraphData();
  assert(g0.nodes.length >= 2, `≥2 nodes (got ${g0.nodes.length})`);
  assert(g0.edges.length >= 1, `≥1 edge (got ${g0.edges.length})`);

  for (const n of g0.nodes) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), `initial finite ${n.id}`);
    // Nearby fixture — not multi-scale clusters yet
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

  // Force simulation ON via async entry (dynamic-imports layout-loop-sim)
  assert(
    typeof createLayoutLoopAsync === "function",
    "createLayoutLoopAsync exported for sim path"
  );
  const loop = await createLayoutLoopAsync({
    graphData: g0,
    iterationsPerFrame: 5,
    simulationEnabled: true,
  });

  const STEPS = 8;
  for (let i = 0; i < STEPS; i++) {
    loop.step();
  }

  const after = loop.getGraphData();
  assert(after.nodes.length === g0.nodes.length, "node count preserved");

  let moved = 0;
  for (const n of after.nodes) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), `finite after layout ${n.id}`);
    const prev = initial.get(n.id);
    if (prev && (n.x !== prev.x || n.y !== prev.y)) moved += 1;
  }
  assert(moved >= 1, `at least one node moved after ${STEPS} steps (moved=${moved})`);

  // Soft-disabled path: positions must not change (sync createLayoutLoop)
  const staticLoop = createLayoutLoop({
    graphData: createMockGraphData(),
    simulationEnabled: false,
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
  assert(staticMoved === 0, `soft-disabled layout keeps positions (moved=${staticMoved})`);

  assert(typeof loop.getGraphData === "function", "handle exposes getGraphData");
  assert(typeof loop.setGraphData === "function", "handle exposes setGraphData");
  loop.start();
  assert(
    loop.status() === "running" || loop.status() === "stopped",
    `status after start (${loop.status()})`
  );
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
