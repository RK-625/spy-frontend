/**
 * verify-hierarchy.mjs — PART_OF ranks + RELATES_TO non-parent + multi-parent.
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
  const hierarchyUrl = pathToFileURL(
    path.join(root, "src/lib/graph/hierarchy.ts")
  ).href;

  const graphDataModule = await import(graphDataUrl);
  const hierarchyModule = await import(hierarchyUrl);

  const { createMockGraphData } = graphDataModule;
  const { assignRanks } = hierarchyModule;

  // --- Mock fixture shape ---
  const mock = createMockGraphData();
  const mockEdges = mock.edges;
  const partOf = mockEdges.filter((e) => e.type === "PART_OF");
  const relates = mockEdges.filter((e) => e.type === "RELATES_TO");

  assert(partOf.length >= 1, `mock has PART_OF edges (got ${partOf.length})`);
  assert(relates.length >= 1, `mock has RELATES_TO edges (got ${relates.length})`);

  const ranks = rankById(mock);
  assert(ranks.get("root") === 0, `root rank 0 (got ${ranks.get("root")})`);
  assert(ranks.get("child-a") === 1, `child-a rank 1 (got ${ranks.get("child-a")})`);
  assert(ranks.get("child-b") === 1, `child-b rank 1 (got ${ranks.get("child-b")})`);
  assert(ranks.get("leaf-a1") === 2, `leaf-a1 rank 2 (got ${ranks.get("leaf-a1")})`);
  assert(ranks.get("leaf-a2") === 2, `leaf-a2 rank 2 (got ${ranks.get("leaf-a2")})`);
  assert(ranks.get("leaf-b1") === 2, `leaf-b1 rank 2 (got ${ranks.get("leaf-b1")})`);

  // Deeper children strictly higher rank than parents
  assert(
    ranks.get("leaf-a1") > ranks.get("child-a") &&
      ranks.get("child-a") > ranks.get("root"),
    "deeper nodes have higher rank than ancestors"
  );

  // --- RELATES_TO alone does not create parent ---
  const relatesOnly = assignRanks({
    nodes: [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0 },
    ],
    edges: [{ id: "e1", source: "a", target: "b", type: "RELATES_TO" }],
  });
  const ro = rankById(relatesOnly);
  assert(ro.get("a") === 0, `RELATES_TO: a stays rank 0 (got ${ro.get("a")})`);
  assert(ro.get("b") === 0, `RELATES_TO: b stays rank 0 (got ${ro.get("b")})`);

  // --- Multi-parent: first PART_OF parent wins ---
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => {
    warns.push(args.map(String).join(" "));
  };
  try {
    const multi = assignRanks({
      nodes: [
        { id: "child", x: 0, y: 0 },
        { id: "p1", x: 0, y: 0 },
        { id: "p2", x: 0, y: 0 },
      ],
      edges: [
        { id: "e1", source: "child", target: "p1", type: "PART_OF" },
        { id: "e2", source: "child", target: "p2", type: "PART_OF" },
      ],
    });
    const mr = rankById(multi);
    // p1 and p2 are roots (0); child under first parent p1 → rank 1
    assert(mr.get("p1") === 0, `multi: p1 rank 0 (got ${mr.get("p1")})`);
    assert(mr.get("p2") === 0, `multi: p2 rank 0 (got ${mr.get("p2")})`);
    assert(mr.get("child") === 1, `multi: child under first parent rank 1 (got ${mr.get("child")})`);
    assert(
      warns.some((w) => w.includes("multi-parent") && w.includes("child")),
      "multi-parent warns"
    );
  } finally {
    console.warn = origWarn;
  }

  // --- Orphan / no PART_OF parent → rank 0 ---
  const orphan = assignRanks({
    nodes: [
      { id: "alone", x: 0, y: 0 },
      { id: "kid", x: 1, y: 1 },
      { id: "par", x: 2, y: 2 },
    ],
    edges: [{ id: "e", source: "kid", target: "par", type: "PART_OF" }],
  });
  const or = rankById(orphan);
  assert(or.get("alone") === 0, `orphan alone rank 0 (got ${or.get("alone")})`);
  assert(or.get("par") === 0, `parent rank 0 (got ${or.get("par")})`);
  assert(or.get("kid") === 1, `kid rank 1 (got ${or.get("kid")})`);

  // Pure: does not mutate input ranks incorrectly — returns new nodes
  const input = {
    nodes: [{ id: "r", x: 0, y: 0, rank: 99 }],
    edges: [],
  };
  const out = assignRanks(input);
  assert(input.nodes[0].rank === 99, "assignRanks does not mutate input node rank");
  assert(out.nodes[0].rank === 0, "assignRanks overwrites rank on output (root=0)");
  assert(out.nodes !== input.nodes, "assignRanks returns new nodes array");

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
