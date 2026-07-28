/**
 * verify-weave-layout.mjs — Slice 5 weave settle smoke (pure + optional Falkor).
 *
 * Run: npm run verify:weave-layout
 *   → npx tsx scripts/verify-weave-layout.mjs
 *
 * Always runs (required CI gate — no Redis):
 *   memories + links → settleMemoryGraphIncremental (mirrors toolset)
 *   → finite xy, not all at origin, PART_OF child rank = parent+1
 *   → focus pins outsiders (no ≥50% free-settle blow-up)
 *   → subgraph settle: cousin outside settle graph unchanged; child moves
 *   → in-memory persist-selection double (dirty ids that would be written)
 *
 * Optional Falkor: when Redis/Falkor is reachable, listGraphTopology smoke.
 * When unavailable, prints a single clear skip reason. Redis is never required
 * for CI green — the in-memory persist-selection path covers write selection.
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

/** Mirror settleAndPersist dirty-write selection without touching Falkor. */
function selectPersistIds(beforeGraph, settled, dirtyIds, rankOverrides) {
  const beforeById = new Map(
    beforeGraph.nodes.map((n) => [n.id, { x: n.x, y: n.y, rank: n.rank }]),
  );
  const wouldWrite = [];
  for (const node of settled.nodes) {
    if (!dirtyIds.has(node.id)) continue;
    const prev = beforeById.get(node.id);
    const rankChanged = prev == null || prev.rank !== node.rank;
    const xyChanged =
      prev == null || prev.x !== node.x || prev.y !== node.y;
    const override =
      rankOverrides != null &&
      Object.prototype.hasOwnProperty.call(rankOverrides, node.id)
        ? rankOverrides[node.id]
        : undefined;
    if (!rankChanged && !xyChanged && override === undefined) continue;
    wouldWrite.push(node.id);
  }
  return wouldWrite;
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
    expandAnchorRing,
    buildSettleSubgraph,
  } = await import(settleUrl);
  const { rankAfterParent, shouldPlaceOnUpsert, shouldPlaceOnLink } =
    await import(placementUrl);
  const { ORIGIN_EPSILON } = await import(recipeUrl);

  console.log("--- pure weave settle (no Falkor) ---");

  assert(typeof settleMemoryGraphIncremental === "function", "settleMemoryGraphIncremental exported");
  assert(typeof expandFocusNeighborhood === "function", "expandFocusNeighborhood exported");
  assert(typeof expandAnchorRing === "function", "expandAnchorRing exported");
  assert(typeof buildSettleSubgraph === "function", "buildSettleSubgraph exported");
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
  assert(!neighborhood.has("cousin"), "cousin outside child 1-hop");

  const anchors = expandAnchorRing(graph, neighborhood);
  assert(anchors.has("cousin"), "cousin is anchor (boundary of movable)");
  assert(anchors.has("sib-a"), "sib-a is anchor");
  assert(!anchors.has("child"), "child is movable not anchor");
  assert(!anchors.has("root"), "root is movable not anchor");

  const sub = buildSettleSubgraph(graph, neighborhood, anchors);
  assert(
    sub.nodes.some((n) => n.id === "child"),
    "settle subgraph includes movable child"
  );
  assert(
    sub.nodes.some((n) => n.id === "cousin"),
    "settle subgraph includes anchor cousin"
  );
  assert(
    sub.nodes.length === neighborhood.size + anchors.size,
    "settle subgraph = movable + anchors only"
  );

  const { graph: settled, dirtyIds, pinned } = settleMemoryGraphIncremental(
    graph,
    {
      focusIds: ["child"],
      rankOverrides: { child: childRank },
      settle: { ticks: 400 },
    },
  );

  assert(pinned === true, "incremental settle pins outsiders / anchors");
  assert(dirtyIds.has("child"), "dirty includes child");
  assert(dirtyIds.has("root"), "dirty includes parent");
  assert(!dirtyIds.has("cousin"), "cousin not dirty (anchor / outside)");

  const byId = new Map(settled.nodes.map((n) => [n.id, n]));
  const childNode = byId.get("child");
  const rootNode = byId.get("root");
  const cousinNode = byId.get("cousin");
  const cousinBefore = graph.nodes.find((n) => n.id === "cousin");
  const childBefore = graph.nodes.find((n) => n.id === "child");

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

  // Cousin outside movable: unchanged (anchor or distant pin).
  assert(
    cousinNode.x === cousinBefore.x && cousinNode.y === cousinBefore.y,
    `cousin outside settle movable unchanged (${cousinNode.x}, ${cousinNode.y})`
  );

  // Child should leave the origin seed after settle.
  assert(
    childBefore != null &&
      (childNode.x !== childBefore.x || childNode.y !== childBefore.y),
    `child moved after settle (${childNode.x}, ${childNode.y})`
  );

  const allNearOrigin = settled.nodes.every(
    (n) => Math.abs(n.x) <= ORIGIN_EPSILON && Math.abs(n.y) <= ORIGIN_EPSILON
  );
  assert(!allNearOrigin, "after settle: not all nodes within origin epsilon");

  // --- in-memory persist selection (no Redis) -----------------------------
  console.log("\n--- in-memory persist selection (no Redis) ---");
  const wouldWrite = selectPersistIds(graph, settled, dirtyIds, {
    child: childRank,
  });
  assert(wouldWrite.includes("child"), "persist selection includes child");
  assert(
    !wouldWrite.includes("cousin"),
    "persist selection excludes cousin (not dirty)"
  );
  assert(
    wouldWrite.every((id) => dirtyIds.has(id)),
    "persist selection ⊆ dirtyIds"
  );

  // Softened pin policy: movable fraction ≥ 50% still pins outsiders.
  console.log("\n--- pin policy (no ≥50% free-settle) ---");
  const hubMemories = [
    stubMemory({ id: "h", name: "H", x: 0, y: 0, rank: 0 }),
    stubMemory({ id: "m1", name: "M1", x: 40, y: 10, rank: 1 }),
    stubMemory({ id: "outsider", name: "Out", x: 300, y: 300, rank: 0 }),
  ];
  const hubLinks = [
    { source: "m1", target: "h", type: "PART_OF" },
    { source: "outsider", target: "h", type: "RELATES_TO" },
  ];
  const { graph: hubGraph } = memoryGraphToGraphDataWithMeta({
    memories: hubMemories,
    links: hubLinks,
  });
  // focus m1 → movable {m1,h} = 2/3 ≥ 0.5 (old policy would free-settle all)
  const hub = settleMemoryGraphIncremental(hubGraph, {
    focusIds: ["m1"],
    settle: { ticks: 400 },
  });
  const hubOut = hub.graph.nodes.find((n) => n.id === "outsider");
  const hubOutBefore = hubGraph.nodes.find((n) => n.id === "outsider");
  assert(hub.pinned === true, "focus present → pin even when movable ≥ 50%");
  assert(!hub.dirtyIds.has("outsider"), "outsider not dirty under soft pin policy");
  assert(
    hubOut != null &&
      hubOutBefore != null &&
      hubOut.x === hubOutBefore.x &&
      hubOut.y === hubOutBefore.y,
    "outsider xy unchanged when movable ratio high"
  );

  // Focus-less settle (bulk / cold): all dirty, finite, not collapsed.
  console.log("\n--- cold / empty-focus settle ---");
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
    settle: { ticks: 400 },
  });
  assert(cold.pinned === false, "empty focus → full free settle (unpinned)");
  assert(cold.dirtyIds.size === coldGraph.nodes.length, "empty focus → all dirty");
  const coldById = new Map(cold.graph.nodes.map((n) => [n.id, n]));
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

  // Rank override alone still scopes to neighborhood (not empty-focus).
  const coldRank = settleMemoryGraphIncremental(coldGraph, {
    rankOverrides: { c: rankAfterParent(0) },
    settle: { ticks: 400 },
  });
  assert(coldRank.graph.nodes.find((n) => n.id === "c").rank === 1, "rank override alone → child rank 1");
  assert(coldById.get("c") != null, "cold nodes present");

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
        "ok: Falkor reachable (DB smoke only — persist path not mutated here; in-memory persist selection covered above)"
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
