/**
 * verify-d3-force-recipe.mjs — Slice 0: pure d3 force recipe on mock graph.
 *
 * Run: npm run verify:d3-force-recipe
 *   → npx tsx scripts/verify-d3-force-recipe.mjs
 *
 * Exit criteria (plans/d3-force-placement-slices.md S0):
 *   - all positions finite; ranks identical to input
 *   - mean PART_OF length < mean RELATES_TO length (soft tolerance)
 *   - static product path (layout-loop) does not import d3-force
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

function meanLength(edges, byId) {
  if (edges.length === 0) return NaN;
  let sum = 0;
  for (const e of edges) {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (!a || !b) continue;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    sum += Math.hypot(dx, dy);
  }
  return sum / edges.length;
}

async function main() {
  const fixtureUrl = pathToFileURL(
    path.join(root, "src/lib/graph/fixtures/mock-graph.ts")
  ).href;
  const recipeUrl = pathToFileURL(
    path.join(root, "src/lib/graph/force-recipe.ts")
  ).href;

  const { createMockGraphData } = await import(fixtureUrl);
  const { settleGraphData, buildForceSimulation } = await import(recipeUrl);

  assert(
    typeof settleGraphData === "function",
    "settleGraphData exported"
  );
  assert(
    typeof buildForceSimulation === "function",
    "buildForceSimulation exported"
  );

  const input = createMockGraphData();
  assert(input.nodes.length >= 2, `mock has ≥2 nodes (got ${input.nodes.length})`);
  assert(input.edges.length >= 1, `mock has ≥1 edge (got ${input.edges.length})`);

  const partOfCount = input.edges.filter((e) => e.type === "PART_OF").length;
  const relatesCount = input.edges.filter((e) => e.type === "RELATES_TO").length;
  assert(partOfCount >= 1, `≥1 PART_OF edge (got ${partOfCount})`);
  assert(relatesCount >= 1, `≥1 RELATES_TO edge (got ${relatesCount})`);

  const rankSnapshot = new Map(input.nodes.map((n) => [n.id, n.rank]));
  const idSnapshot = input.nodes.map((n) => n.id).sort();
  const labelSnapshot = new Map(
    input.nodes.map((n) => [n.id, n.label ?? null])
  );

  // Snapshot input coords so we can prove settle does not mutate the input.
  const inputXY = new Map(
    input.nodes.map((n) => [n.id, { x: n.x, y: n.y }])
  );

  const settled = settleGraphData(input, { ticks: 400 });

  for (const n of input.nodes) {
    const before = inputXY.get(n.id);
    assert(
      n.x === before.x && n.y === before.y,
      `input node ${n.id} not mutated by settle`
    );
  }

  assert(
    settled.nodes.length === input.nodes.length,
    "settled node count matches input"
  );
  assert(
    settled.edges.length === input.edges.length,
    "settled edge count matches input"
  );

  const settledIds = settled.nodes.map((n) => n.id).sort();
  assert(
    settledIds.join(",") === idSnapshot.join(","),
    "node ids preserved"
  );

  for (const n of settled.nodes) {
    assert(
      Number.isFinite(n.x) && Number.isFinite(n.y),
      `finite position ${n.id} (x=${n.x}, y=${n.y})`
    );
    assert(
      rankSnapshot.get(n.id) === n.rank,
      `rank unchanged for ${n.id} (got ${n.rank}, want ${rankSnapshot.get(n.id)})`
    );
    assert(
      (n.label ?? null) === labelSnapshot.get(n.id),
      `label unchanged for ${n.id}`
    );
  }

  const byId = new Map(settled.nodes.map((n) => [n.id, n]));
  const partOf = settled.edges.filter((e) => e.type === "PART_OF");
  const relates = settled.edges.filter((e) => e.type === "RELATES_TO");
  const meanPo = meanLength(partOf, byId);
  const meanRt = meanLength(relates, byId);

  assert(Number.isFinite(meanPo), `mean PART_OF length finite (${meanPo})`);
  assert(Number.isFinite(meanRt), `mean RELATES_TO length finite (${meanRt})`);

  // Soft assert with tolerance: hierarchy should be tighter than associative.
  // Allow 8% slack for hub stress chords that pull PART_OF spokes outward.
  const slack = 1.08;
  assert(
    meanPo < meanRt * slack,
    `mean PART_OF (${meanPo.toFixed(2)}) < mean RELATES_TO (${meanRt.toFixed(2)}) * ${slack}`
  );
  console.log(
    `  lengths: PART_OF mean=${meanPo.toFixed(2)} RELATES_TO mean=${meanRt.toFixed(2)}`
  );

  // Static product path must not pull d3-force (Slice 0: no wire yet).
  const layoutLoopSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/layout-loop.ts"),
    "utf8"
  );
  assert(
    !layoutLoopSrc.includes("d3-force") &&
      !layoutLoopSrc.includes("force-recipe"),
    "layout-loop.ts does not import d3-force / force-recipe"
  );

  const canvasSrc = fs.readFileSync(
    path.join(root, "src/components/graph/graph-canvas.tsx"),
    "utf8"
  );
  assert(
    !canvasSrc.includes("d3-force") && !canvasSrc.includes("force-recipe"),
    "graph-canvas.tsx does not import d3-force / force-recipe"
  );

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nverify:d3-force-recipe passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
