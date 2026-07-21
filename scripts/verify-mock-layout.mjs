/**
 * verify-mock-layout.mjs — Step 2 checks for multi-cluster mock + FA2 loop.
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
  const mockUrl = pathToFileURL(path.join(root, "src/lib/graph/mock-graph.ts")).href;
  const layoutUrl = pathToFileURL(path.join(root, "src/lib/graph/layout-loop.ts")).href;

  const mock = await import(mockUrl);
  const layout = await import(layoutUrl);

  const { createMockGraph, CLUSTER_ANCHORS } = mock;
  const { createLayoutLoop } = layout;

  const g0 = createMockGraph();
  const clusters = new Set(g0.nodes.map((n) => n.cluster).filter(Boolean));
  assert(clusters.size >= 4, `≥4 clusters represented (got ${clusters.size}: ${[...clusters]})`);

  let maxAbs = 0;
  for (const n of g0.nodes) {
    maxAbs = Math.max(maxAbs, Math.abs(n.x), Math.abs(n.y));
  }
  assert(maxAbs >= 1e16, `max |coord| ≥ 1e16 (got ${maxAbs})`);

  for (const n of g0.nodes) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), `initial finite ${n.id}`);
  }

  const initial = new Map(g0.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

  const loop = createLayoutLoop({
    graph: g0,
    iterationsPerFrame: 5,
  });

  const STEPS = 8;
  for (let i = 0; i < STEPS; i++) {
    loop.step();
  }

  const after = loop.getGraph();
  assert(after.nodes.length === g0.nodes.length, "node count preserved");

  let moved = 0;
  for (const n of after.nodes) {
    assert(Number.isFinite(n.x) && Number.isFinite(n.y), `finite after layout ${n.id}`);
    const prev = initial.get(n.id);
    if (prev && (n.x !== prev.x || n.y !== prev.y)) moved += 1;
  }
  assert(moved >= 1, `at least one node moved after ${STEPS} steps (moved=${moved})`);

  const dAnchor = CLUSTER_ANCHORS.D;
  const dNodes = after.nodes.filter((n) => n.cluster === "D" || String(n.id).startsWith("D-"));
  assert(dNodes.length > 0, "cluster D has nodes");

  for (const n of dNodes) {
    const dist = Math.hypot(n.x - dAnchor.x, n.y - dAnchor.y);
    // Stay near D anchor (local radius); must remain << 1e15 at world scale ~1e17
    assert(dist < 1e6, `D node ${n.id} local radius < 1e6 (dist=${dist})`);
    assert(
      Math.abs(n.x) >= 1e16 || Math.abs(n.y) >= 1e16,
      `D node ${n.id} still at extreme world scale (x=${n.x}, y=${n.y})`
    );
  }

  assert(typeof loop.getGraph === "function", "handle exposes getGraph");
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
