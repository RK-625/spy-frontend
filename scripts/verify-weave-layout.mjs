/**
 * verify-weave-layout.mjs — Slice 5 weave settle smoke (pure + optional Falkor).
 *
 * Run: npm run verify:weave-layout
 *   → npx tsx scripts/verify-weave-layout.mjs
 *
 * Always runs a pure path (no Redis):
 *   memories + links → settleMemoryGraphIncremental (mirrors toolset)
 *   → finite xy, not all at origin, PART_OF child rank = parent+1
 *
 * Optional DB section: skipped with a clear message when Falkor/Redis unavailable.
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

function stubMemory(partial) {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    content: "",
    impression: "",
    searchEmbedding: [],
    contentEmbedding: [],
    confidence: 1,
    ...partial,
  };
}

async function main() {
  const adapterUrl = pathToFileURL(
    path.join(root, "src/lib/graph/from-memory-graph.ts")
  ).href;
  const settleUrl = pathToFileURL(
    path.join(root, "src/lib/memory-layout-settle.ts")
  ).href;
  const placementUrl = pathToFileURL(
    path.join(root, "src/lib/memory-placement.ts")
  ).href;
  const recipeUrl = pathToFileURL(
    path.join(root, "src/lib/graph/force-recipe.ts")
  ).href;

  const { memoryGraphToGraphDataWithMeta } = await import(adapterUrl);
  const {
    settleMemoryGraphIncremental,
    expandFocusNeighborhood,
  } = await import(settleUrl);
  const { rankAfterParent, shouldPlaceOnUpsert, shouldPlaceOnLink } =
    await import(placementUrl);
  const { ORIGIN_EPSILON } = await import(recipeUrl);

  console.log("--- pure weave settle (no Falkor) ---");

  assert(typeof settleMemoryGraphIncremental === "function", "settleMemoryGraphIncremental exported");
  assert(typeof expandFocusNeighborhood === "function", "expandFocusNeighborhood exported");
  assert(rankAfterParent(0) === 1, "rankAfterParent(0) === 1");
  assert(rankAfterParent(2) === 3, "rankAfterParent(2) === 3");
  assert(
    shouldPlaceOnUpsert({ isCreate: true, existing: null }) === true,
    "shouldPlaceOnUpsert create → true"
  );
  assert(
    shouldPlaceOnUpsert({
      isCreate: false,
      existing: { x: 10, y: 20 },
    }) === false,
    "shouldPlaceOnUpsert content-only with xy → false"
  );
  assert(
    shouldPlaceOnLink({
      type: "PART_OF",
      sourceLayout: { x: 1, y: 2, rank: 0 },
    }) === true,
    "shouldPlaceOnLink PART_OF → true"
  );

  // Synthetic KB: placed parent + distant siblings; new child missing xy.
  const memories = [
    stubMemory({ id: "root", name: "Root", x: 0, y: 0, rank: 0 }),
    stubMemory({ id: "sib-a", name: "Sib A", x: 120, y: -40, rank: 1 }),
    stubMemory({ id: "sib-b", name: "Sib B", x: -90, y: 55, rank: 1 }),
    stubMemory({ id: "cousin", name: "Cousin", x: 200, y: 180, rank: 0 }),
    // Weave create / PART_OF child — missing layout (toolset settle path).
    stubMemory({ id: "child", name: "Child", rank: 0 }),
  ];
  const links = [
    { source: "sib-a", target: "root", type: "PART_OF" },
    { source: "sib-b", target: "root", type: "PART_OF" },
    { source: "child", target: "root", type: "PART_OF" },
    { source: "cousin", target: "root", type: "RELATES_TO" },
  ];

  const { graph, needsLayout } = memoryGraphToGraphDataWithMeta({
    memories,
    links,
  });
  assert(needsLayout === true, "child missing xy → needsLayout");
  assert(graph.nodes.length === 5, "graph has 5 nodes");

  const childRank = rankAfterParent(0);
  assert(childRank === 1, "PART_OF child rank = parent+1 (policy)");

  const neighborhood = expandFocusNeighborhood(graph, ["child"], {
    child: childRank,
  });
  assert(neighborhood.has("child"), "neighborhood includes focus child");
  assert(neighborhood.has("root"), "neighborhood includes PART_OF parent");
  assert(
    !neighborhood.has("cousin") || neighborhood.has("root"),
    "cousin not required in 1-hop of child (parent link only)"
  );
  assert(!neighborhood.has("cousin"), "cousin outside child 1-hop");

  const { graph: settled, dirtyIds, pinned } = settleMemoryGraphIncremental(
    graph,
    {
      focusIds: ["child"],
      rankOverrides: { child: childRank },
      settle: { ticks: 400 },
    },
  );

  assert(pinned === true, "incremental settle pins non-neighborhood nodes");
  assert(dirtyIds.has("child"), "dirty includes child");
  assert(dirtyIds.has("root"), "dirty includes parent");
  assert(!dirtyIds.has("cousin"), "cousin not dirty (pinned)");

  const byId = new Map(settled.nodes.map((n) => [n.id, n]));
  const childNode = byId.get("child");
  const rootNode = byId.get("root");
  const cousinNode = byId.get("cousin");
  const cousinBefore = graph.nodes.find((n) => n.id === "cousin");

  assert(
    childNode != null && rootNode != null && cousinNode != null,
    "nodes present after settle"
  );
  assert(
    Number.isFinite(childNode.x) && Number.isFinite(childNode.y),
    `child finite xy (${childNode.x}, ${childNode.y})`
  );
  assert(
    Number.isFinite(rootNode.x) && Number.isFinite(rootNode.y),
    `root finite xy (${rootNode.x}, ${rootNode.y})`
  );
  assert(childNode.rank === 1, `child rank === 1 (got ${childNode.rank})`);
  assert(rootNode.rank === 0, `root rank unchanged (got ${rootNode.rank})`);

  // Pinned cousin must keep seed coords.
  assert(
    cousinNode.x === cousinBefore.x && cousinNode.y === cousinBefore.y,
    `pinned cousin xy unchanged (${cousinNode.x}, ${cousinNode.y})`
  );

  const allNearOrigin = settled.nodes.every(
    (n) => Math.abs(n.x) <= ORIGIN_EPSILON && Math.abs(n.y) <= ORIGIN_EPSILON
  );
  assert(!allNearOrigin, "after settle: not all nodes within origin epsilon");

  // Focus-less settle (bulk / cold): all dirty, finite, not collapsed.
  const coldMemories = [
    stubMemory({ id: "a", name: "A", rank: 0 }),
    stubMemory({ id: "b", name: "B", rank: 0 }),
    stubMemory({ id: "c", name: "C", rank: 1 }),
  ];
  const coldLinks = [
    { source: "c", target: "a", type: "PART_OF" },
    { source: "b", target: "a", type: "RELATES_TO" },
  ];
  const { graph: coldGraph } = memoryGraphToGraphDataWithMeta({
    memories: coldMemories,
    links: coldLinks,
  });
  const cold = settleMemoryGraphIncremental(coldGraph, {
    rankOverrides: { c: rankAfterParent(0) },
    settle: { ticks: 400 },
  });
  // rankOverrides alone counts as focus → may pin; either way ranks + finite.
  const coldById = new Map(cold.graph.nodes.map((n) => [n.id, n]));
  assert(coldById.get("c").rank === 1, "cold PART_OF child rank = 1");
  for (const n of cold.graph.nodes) {
    assert(
      Number.isFinite(n.x) && Number.isFinite(n.y),
      `cold finite ${n.id}`
    );
  }
  const coldAllOrigin = cold.graph.nodes.every(
    (n) => Math.abs(n.x) <= ORIGIN_EPSILON && Math.abs(n.y) <= ORIGIN_EPSILON
  );
  assert(!coldAllOrigin, "cold settle: not all at origin");

  // --- optional Falkor (skip when unavailable) ----------------------------
  console.log("\n--- optional Falkor persist ---");
  try {
    const falkorUrl = pathToFileURL(path.join(root, "src/lib/falkor.ts")).href;
    const falkor = await import(falkorUrl);
    if (typeof falkor.listGraphTopology !== "function") {
      console.log("skip: listGraphTopology missing");
    } else {
      await falkor.listGraphTopology();
      console.log(
        "ok: Falkor reachable (DB smoke only — persist path not mutated here)"
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
      `skip: Falkor/Redis unavailable (${msg.split("\n")[0] ?? "error"})`
    );
  }

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nverify:weave-layout passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
