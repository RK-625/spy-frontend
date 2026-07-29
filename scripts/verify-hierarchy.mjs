/**
 * verify-hierarchy.mjs — stored ranks on the mock fixture + typed edges.
 *
 * Rank is a stored node field (not computed on the canvas). This script
 * checks the mock tree has the expected ranks and PART_OF / RELATES_TO edges.
 *
 * Run: npm run verify:hierarchy
 *   → npx tsx scripts/verify-hierarchy.mjs
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

function rankById(graphData) {
  return new Map(graphData.nodes.map((n) => [n.id, n.rank]));
}

async function main() {
  const graphDataUrl = pathToFileURL(
    path.join(root, "src/lib/graph/graph-data.ts")
  ).href;

  const graphDataModule = await import(graphDataUrl);
  const { createMockGraphData } = graphDataModule;

  const mock = createMockGraphData();
  const partOf = mock.edges.filter((e) => e.type === "PART_OF");
  const relates = mock.edges.filter((e) => e.type === "RELATES_TO");

  assert(partOf.length >= 1, `mock has PART_OF edges (got ${partOf.length})`);
  assert(relates.length >= 1, `mock has RELATES_TO edges (got ${relates.length})`);

  for (const e of mock.edges) {
    assert(
      e.type === "PART_OF" || e.type === "RELATES_TO",
      `edge ${e.id} typed (got ${e.type})`
    );
  }

  for (const n of mock.nodes) {
    assert(typeof n.rank === "number", `node ${n.id} has stored rank`);
  }

  const ranks = rankById(mock);
  assert(ranks.get("root") === 0, `root rank 0 (got ${ranks.get("root")})`);
  assert(ranks.get("child-a") === 1, `child-a rank 1 (got ${ranks.get("child-a")})`);
  assert(ranks.get("child-b") === 1, `child-b rank 1 (got ${ranks.get("child-b")})`);
  assert(ranks.get("leaf-a1") === 2, `leaf-a1 rank 2 (got ${ranks.get("leaf-a1")})`);
  assert(ranks.get("leaf-a2") === 2, `leaf-a2 rank 2 (got ${ranks.get("leaf-a2")})`);
  assert(ranks.get("leaf-b1") === 2, `leaf-b1 rank 2 (got ${ranks.get("leaf-b1")})`);

  assert(
    ranks.get("leaf-a1") > ranks.get("child-a") &&
      ranks.get("child-a") > ranks.get("root"),
    "stored ranks deepen down the PART_OF tree"
  );

  // Layout clone path preserves stored ranks (no recompute)
  const layoutUrl = pathToFileURL(
    path.join(root, "src/lib/graph/layout-loop.ts")
  ).href;
  const layout = await import(layoutUrl);
  const loop = layout.createLayoutLoop({
    graphData: mock,
  });
  const after = loop.getGraphData();
  for (const n of after.nodes) {
    const expected = ranks.get(n.id);
    assert(n.rank === expected, `layout preserves rank for ${n.id} (${n.rank} === ${expected})`);
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll hierarchy checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
