/**
 * verify-d3-force-recipe.mjs — pure settle + placeTopology cold-start.
 *
 * Run: npm run verify:d3-force-recipe
 *   → npx tsx scripts/verify-d3-force-recipe.mjs
 *
 * Exit criteria (plans/d3-force-placement-slices.md S0):
 *   - all positions finite; ranks identical to input
 *   - mean PART_OF length < mean RELATES_TO length (soft tolerance)
 *   - product layout-loop-d3 paint store does not import d3-force
 *
 * Exit criteria (S2 cold-start + client-placement-cache):
 *   - placeTopology cache miss → settle from (0,0) + save
 *   - settleGraphData pure (no localStorage)
 *   - placeTopology hit → paint cached poses without re-settle
 *   - ranks unchanged
 *   - settleIfNeeded / applyColdStartJitter / seedNodePosition removed
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

function maxPairwiseDistance(nodes) {
  let max = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.hypot(dx, dy);
      if (d > max) max = d;
    }
  }
  return max;
}

function stubMemory(partial) {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    content: "",
    impression: "",
    confidence: 1,
    ...partial,
  };
}

async function main() {
  const fixtureUrl = pathToFileURL(
    path.join(root, "src/deprecated/pixi-graph/fixtures/mock-graph.ts")
  ).href;
  const recipeUrl = pathToFileURL(
    path.join(root, "src/deprecated/pixi-graph/placement/force-recipe.ts")
  ).href;
  const placeUrl = pathToFileURL(
    path.join(root, "src/deprecated/pixi-graph/placement/place-topology.ts")
  ).href;
  const cacheUrl = pathToFileURL(
    path.join(root, "src/deprecated/pixi-graph/placement/placement-cache.ts")
  ).href;

  const { createMockGraphData } = await import(fixtureUrl);
  const recipeMod = await import(recipeUrl);
  const {
    settleGraphData,
    buildForceSimulation,
    ORIGIN_EPSILON,
  } = recipeMod;
  const { placeTopology } = await import(placeUrl);
  const { loadPlacementCache, computeTopoFingerprint, deriveRanks } =
    await import(cacheUrl);

  assert(
    typeof settleGraphData === "function",
    "settleGraphData exported"
  );
  assert(
    typeof buildForceSimulation === "function",
    "buildForceSimulation exported"
  );
  assert(typeof placeTopology === "function", "placeTopology exported");
  // Fence: removed defensive / unused APIs must not reappear.
  assert(
    typeof recipeMod.settleIfNeeded === "undefined",
    "settleIfNeeded removed (host uses placeTopology)"
  );
  assert(
    typeof recipeMod.applyColdStartJitter === "undefined",
    "applyColdStartJitter removed (miss starts at origin)"
  );
  assert(
    typeof recipeMod.COLD_START_JITTER === "undefined",
    "COLD_START_JITTER removed"
  );
  assert(
    typeof recipeMod.graphNeedsLayout === "undefined",
    "graphNeedsLayout removed (placeTopology owns hit/miss)"
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

  // --- settleGraphData is pure (no localStorage write) --------------------
  console.log("\n--- settleGraphData purity ---");
  const purityStore = new Map();
  const purityLs = {
    getItem(k) {
      return purityStore.get(k) ?? null;
    },
    setItem(k, v) {
      purityStore.set(k, String(v));
    },
    removeItem(k) {
      purityStore.delete(k);
    },
  };
  globalThis.localStorage = purityLs;
  globalThis.window = globalThis.window || { localStorage: purityLs };
  globalThis.window.localStorage = purityLs;
  settleGraphData(input, { ticks: 50 });
  assert(
    purityStore.size === 0,
    "settleGraphData does not write localStorage (pure)"
  );

  // --- placeTopology cold miss from origin -------------------------------
  console.log("\n--- cold-start placeTopology ---");

  // Clear storage for cold path.
  purityStore.clear();

  const coldMemories = [
    stubMemory({ id: "root", name: "Root" }),
    stubMemory({ id: "child-a", name: "Child A" }),
    stubMemory({ id: "child-b", name: "Child B" }),
    stubMemory({ id: "leaf", name: "Leaf" }),
    stubMemory({ id: "side", name: "Side" }),
  ];
  const coldLinks = [
    { source: "child-a", target: "root", type: "PART_OF" },
    { source: "child-b", target: "root", type: "PART_OF" },
    { source: "leaf", target: "child-a", type: "PART_OF" },
    { source: "side", target: "root", type: "RELATES_TO" },
    { source: "child-a", target: "child-b", type: "RELATES_TO" },
  ];

  const coldGraph = placeTopology({
    memories: coldMemories,
    links: coldLinks,
  });

  assert(coldGraph.nodes.length === 5, "cold graph has 5 nodes");
  assert(coldGraph.edges.length === 5, "cold graph has 5 edges");

  for (const n of coldGraph.nodes) {
    assert(
      Number.isFinite(n.x) && Number.isFinite(n.y),
      `cold placeTopology finite ${n.id} (x=${n.x}, y=${n.y})`
    );
  }

  const allNearOrigin = coldGraph.nodes.every(
    (n) => Math.abs(n.x) <= ORIGIN_EPSILON && Math.abs(n.y) <= ORIGIN_EPSILON
  );
  assert(
    !allNearOrigin,
    "placeTopology miss settle: nodes not all within ORIGIN_EPSILON of origin"
  );

  const spread = maxPairwiseDistance(coldGraph.nodes);
  assert(
    spread > 1,
    `cold-start max pairwise distance > 1 (got ${spread.toFixed(4)})`
  );
  console.log(`  cold-start spread (max pairwise)=${spread.toFixed(2)}`);

  // Cache was saved on miss.
  const coldRanks = deriveRanks(coldMemories, coldLinks);
  const coldFp = computeTopoFingerprint(coldMemories, coldLinks, coldRanks);
  const coldCache = loadPlacementCache(coldFp);
  assert(coldCache != null, "placeTopology miss saves placement cache");

  // --- Client placement cache hit ----------------------------------------
  console.log("\n--- placement cache hit round-trip ---");
  const store = new Map();
  const mockLs = {
    getItem(k) {
      return store.get(k) ?? null;
    },
    setItem(k, v) {
      store.set(k, String(v));
    },
    removeItem(k) {
      store.delete(k);
    },
  };
  globalThis.localStorage = mockLs;
  globalThis.window = globalThis.window || { localStorage: mockLs };
  globalThis.window.localStorage = mockLs;

  const cacheMemories = [
    stubMemory({ id: "r", name: "R" }),
    stubMemory({ id: "c", name: "C" }),
  ];
  const cleanLinks = [{ source: "c", target: "r", type: "PART_OF" }];

  const firstGraph = placeTopology({
    memories: cacheMemories,
    links: cleanLinks,
  });
  assert(firstGraph.nodes.length === 2, "cold placeTopology yields 2 nodes");
  const settledById = new Map(firstGraph.nodes.map((n) => [n.id, n]));

  const secondGraph = placeTopology({
    memories: cacheMemories,
    links: cleanLinks,
  });
  for (const n of secondGraph.nodes) {
    const s = settledById.get(n.id);
    assert(
      s != null && n.x === s.x && n.y === s.y && n.rank === s.rank,
      `cache hit pose equality for ${n.id}`
    );
  }

  // Paint store + canvas: no d3-force on product host static path.
  assert(
    !fs.existsSync(path.join(root, "src/deprecated/pixi-graph/layout/layout-loop.ts")),
    "layout-loop.ts thin wrapper deleted"
  );
  const layoutLoopD3Src = fs.readFileSync(
    path.join(root, "src/deprecated/pixi-graph/layout/layout-loop-d3.ts"),
    "utf8"
  );
  assert(
    !/from\s+["']d3-force["']/.test(layoutLoopD3Src) &&
      !/from\s+["'][^"']*force-recipe["']/.test(layoutLoopD3Src),
    "layout-loop-d3 does not import d3-force / force-recipe"
  );
  assert(
    !/\bcreateStaticLayoutLoop\b/.test(layoutLoopD3Src) &&
      !/\blayoutEngine\b/.test(layoutLoopD3Src) &&
      !/\bambientMotion\b/.test(layoutLoopD3Src) &&
      !/settle\s*\?/.test(layoutLoopD3Src),
    "layout-loop-d3 has no ambient / settle option surface"
  );

  const canvasSrc = fs.readFileSync(
    path.join(root, "src/components/graph/graph-canvas.tsx"),
    "utf8"
  );
  assert(
    !/from\s+["'][^"']*force-recipe["']/.test(canvasSrc) &&
      !/from\s+["']d3-force["']/.test(canvasSrc),
    "graph-canvas.tsx does not statically import d3-force / force-recipe"
  );
  assert(
    canvasSrc.includes("placeTopology") &&
      canvasSrc.includes("layout-loop-d3"),
    "graph-canvas uses placeTopology + dynamic layout-loop-d3"
  );
  assert(
    !canvasSrc.includes("createLayoutLoopAsync"),
    "graph-canvas does not use createLayoutLoopAsync"
  );

  // Source fences: dead helpers / dual settle paths must stay deleted.
  console.log("\n--- removed-API source fences ---");
  const forceRecipeSrc = fs.readFileSync(
    path.join(root, "src/deprecated/pixi-graph/placement/force-recipe.ts"),
    "utf8"
  );
  const placeSrc = fs.readFileSync(
    path.join(root, "src/deprecated/pixi-graph/placement/place-topology.ts"),
    "utf8"
  );
  const cacheSrc = fs.readFileSync(
    path.join(root, "src/deprecated/pixi-graph/placement/placement-cache.ts"),
    "utf8"
  );
  const barrelSrc = fs.readFileSync(
    path.join(root, "src/deprecated/pixi-graph/index.ts"),
    "utf8"
  );

  assert(
    !fs.existsSync(
      path.join(root, "src/deprecated/pixi-graph/placement/from-memory-graph.ts")
    ),
    "from-memory-graph.ts deleted (replaced by place-topology)"
  );
  assert(
    !/\bmemoryGraphToGraphDataWithMeta\b/.test(barrelSrc) &&
      !/\bneedsLayout\b/.test(barrelSrc) &&
      !/\bseedNodePosition\b/.test(barrelSrc) &&
      !/\bcomputeBfsOrder\b/.test(barrelSrc) &&
      !/\bfilterTopologyLinks\b/.test(barrelSrc) &&
      !/\bMemoryGraphNodeInput\b/.test(barrelSrc) &&
      !/\bGraphMapResult\b/.test(barrelSrc) &&
      !/\bcreateLayoutLoopAsync\b/.test(barrelSrc) &&
      !/\bsettleGraphData\b/.test(barrelSrc) &&
      !/\bseedXY\b/.test(forceRecipeSrc),
    "barrel/force-recipe: deleted symbols not present"
  );
  assert(
    !/\bseedNodePosition\b/.test(cacheSrc) &&
      !/\bcomputeBfsOrder\b/.test(cacheSrc) &&
      !/\brank\s*:\s*number/.test(cacheSrc.replace(/deriveRanks[\s\S]*?^}/m, "")),
    "placement-cache: no seeds/BFS; CachedPlacementNode is xy-only"
  );
  // Stronger: type body has no rank field
  assert(
    /export type CachedPlacementNode\s*=\s*\{\s*x:\s*number;\s*y:\s*number;\s*\}/.test(
      cacheSrc.replace(/\s+/g, " ")
    ),
    "CachedPlacementNode is { x, y } only"
  );
  assert(
    !/savePlacementCache/.test(forceRecipeSrc),
    "force-recipe: no savePlacementCache (pure settle)"
  );
  assert(
    !/settle\s*\?/.test(layoutLoopD3Src) &&
      !/\bgetGraphData\b/.test(layoutLoopD3Src),
    "layout-loop-d3: no settle option / getGraphData"
  );
  assert(
    !/export\s+function\s+graphNeedsLayout\b/.test(forceRecipeSrc) &&
      !/function\s+graphNeedsLayout\b/.test(forceRecipeSrc),
    "force-recipe: no graphNeedsLayout function"
  );
  assert(
    !/\bpinnedNodeIds\b/.test(forceRecipeSrc) &&
      !/\btoPinnedIdSet\b/.test(forceRecipeSrc),
    "force-recipe: pinnedNodeIds / toPinnedIdSet removed"
  );
  assert(
    !/\bSettleIfNeededOptions\b/.test(forceRecipeSrc) &&
      !/needsLayout\s*:\s*boolean/.test(forceRecipeSrc) &&
      !/options\.needsLayout\b/.test(forceRecipeSrc) &&
      !/if\s*\(\s*!options\.needsLayout/.test(forceRecipeSrc),
    "force-recipe: settle needsLayout gate / SettleIfNeededOptions removed"
  );
  assert(
    !/export\s+function\s+settleIfNeeded\b/.test(forceRecipeSrc) &&
      !/function\s+settleIfNeeded\b/.test(forceRecipeSrc) &&
      !/export\s+function\s+applyColdStartJitter\b/.test(forceRecipeSrc) &&
      !/function\s+applyColdStartJitter\b/.test(forceRecipeSrc) &&
      !/function\s+hashNodeId\b/.test(forceRecipeSrc) &&
      !/export\s+const\s+COLD_START_JITTER\b/.test(forceRecipeSrc) &&
      !/const\s+COLD_START_JITTER\b/.test(forceRecipeSrc),
    "force-recipe: settleIfNeeded / cold-start jitter removed"
  );
  assert(
    !/\bsettleIfNeeded\b/.test(barrelSrc) &&
      !/\bapplyColdStartJitter\b/.test(barrelSrc) &&
      !/\bCOLD_START_JITTER\b/.test(barrelSrc) &&
      !/\bSettleIfNeededOptions\b/.test(barrelSrc),
    "barrel: settleIfNeeded / jitter / SettleIfNeededOptions not re-exported"
  );
  assert(
    !/\bgraphNeedsLayout\b/.test(barrelSrc),
    "barrel: graphNeedsLayout not re-exported"
  );
  assert(
    !fs.existsSync(
      path.join(root, "src/deprecated/pixi-graph/placement/memory-placement.ts")
    ),
    "memory-placement.ts is gone"
  );
  assert(
    !/memory-placement/.test(barrelSrc) &&
      !/\bisPlacedLayout\b/.test(barrelSrc) &&
      !/\brankAfterParent\b/.test(barrelSrc) &&
      !/\bPARENT_CHILD_RADIUS\b/.test(barrelSrc) &&
      !/\bLAYOUT_ORIGIN_EPSILON\b/.test(barrelSrc),
    "barrel: no memory-placement pose helpers re-exported"
  );
  // deriveRanks must not reintroduce the post-computeRank zero-fill loop.
  assert(
    !/for\s*\(\s*const\s+m\s+of\s+memories\s*\)\s*\{\s*if\s*\(\s*!ranks\.has\(m\.id\)\s*\)\s*\{\s*ranks\.set\(m\.id,\s*0\)/.test(
      cacheSrc.replace(/\s+/g, " ")
    ),
    "placement-cache: no dead deriveRanks zero-fill fallback loop"
  );
  // placeTopology miss origin lock
  assert(
    /x:\s*cached\?\.x\s*\?\?\s*0/.test(placeSrc) ||
      /cached\?\.x\s*\?\?\s*0/.test(placeSrc),
    "placeTopology miss starts at x=0 (no seeds)"
  );

  // Pixi dead-surface fences (hang timer / bakeAll dual path / insetSegment).
  const rendererSrc = fs.readFileSync(
    path.join(root, "src/deprecated/pixi-graph/render/pixi-renderer.ts"),
    "utf8"
  );
  const drawArrowSrc = fs.readFileSync(
    path.join(root, "src/deprecated/pixi-graph/render/draw-arrow.ts"),
    "utf8"
  );
  assert(
    !/\barmBakeHangTimer\b/.test(rendererSrc) &&
      !/\bclearBakeHangTimer\b/.test(rendererSrc) &&
      !/BAKE_WORKER_HANG_MS/.test(rendererSrc) &&
      !/\bbakeHangTimer\b/.test(rendererSrc),
    "pixi-renderer: no bake-worker hang timer"
  );
  assert(
    !/\bbakeAll\b/.test(rendererSrc) &&
      !/function\s+buildSamplePayload\s*\(\s*cullAabb\s*:\s*WorldAabb\s*\|\s*null/.test(
        rendererSrc
      ),
    "pixi-renderer: no bakeAll / nullable cull dual path in buildSamplePayload"
  );
  assert(
    !/export\s+function\s+insetSegment\b/.test(drawArrowSrc) &&
      !/\binsetSegment\b/.test(barrelSrc),
    "draw-arrow + barrel: insetSegment removed (was verify-only)"
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
