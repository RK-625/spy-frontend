/**
 * verify-d3-force-recipe.mjs — Slice 0 + Slice 2 cold-start.
 *
 * Run: npm run verify:d3-force-recipe
 *   → npx tsx scripts/verify-d3-force-recipe.mjs
 *
 * Exit criteria (plans/d3-force-placement-slices.md S0):
 *   - all positions finite; ranks identical to input
 *   - mean PART_OF length < mean RELATES_TO length (soft tolerance)
 *   - static product path (layout-loop) does not import d3-force
 *
 * Exit criteria (S2 cold-start + client-placement-cache):
 *   - topology without cache → needsLayout true (fingerprint miss)
 *   - adapter seeds via seedNodePosition (not origin zeros)
 *   - settleIfNeeded → finite positions, not all near origin
 *   - ranks unchanged
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
    searchEmbedding: [],
    contentEmbedding: [],
    confidence: 1,
    ...partial,
  };
}

async function main() {
  const fixtureUrl = pathToFileURL(
    path.join(root, "src/lib/graph/fixtures/mock-graph.ts")
  ).href;
  const recipeUrl = pathToFileURL(
    path.join(root, "src/lib/graph/placement/force-recipe.ts")
  ).href;
  const adapterUrl = pathToFileURL(
    path.join(root, "src/lib/graph/placement/from-memory-graph.ts")
  ).href;

  const { createMockGraphData } = await import(fixtureUrl);
  const {
    settleGraphData,
    buildForceSimulation,
    settleIfNeeded,
    graphNeedsLayout,
    ORIGIN_EPSILON,
  } = await import(recipeUrl);
  const {
    hasFiniteLayoutXY,
    memoryGraphToGraphDataWithMeta,
  } = await import(adapterUrl);

  assert(
    typeof settleGraphData === "function",
    "settleGraphData exported"
  );
  assert(
    typeof buildForceSimulation === "function",
    "buildForceSimulation exported"
  );
  assert(typeof settleIfNeeded === "function", "settleIfNeeded exported");
  assert(typeof graphNeedsLayout === "function", "graphNeedsLayout exported");

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

  // --- Slice 2: cold-start missing xy ------------------------------------
  console.log("\n--- Slice 2 cold-start ---");

  assert(
    !hasFiniteLayoutXY(undefined, undefined),
    "hasFiniteLayoutXY(undefined, undefined) is false"
  );
  assert(
    !hasFiniteLayoutXY(NaN, 0),
    "hasFiniteLayoutXY(NaN, 0) is false"
  );
  assert(
    hasFiniteLayoutXY(1, 2),
    "hasFiniteLayoutXY(1, 2) is true"
  );

  const coldMemories = [
    stubMemory({ id: "root", name: "Root", rank: 0 }),
    stubMemory({ id: "child-a", name: "Child A", rank: 1 }),
    stubMemory({ id: "child-b", name: "Child B", rank: 1 }),
    stubMemory({ id: "leaf", name: "Leaf", rank: 2 }),
    stubMemory({ id: "side", name: "Side", rank: 0 }),
  ];
  const coldLinks = [
    { source: "child-a", target: "root", type: "PART_OF" },
    { source: "child-b", target: "root", type: "PART_OF" },
    { source: "leaf", target: "child-a", type: "PART_OF" },
    { source: "side", target: "root", type: "RELATES_TO" },
    { source: "child-a", target: "child-b", type: "RELATES_TO" },
  ];

  const { graph: coldGraph, needsLayout } = memoryGraphToGraphDataWithMeta({
    memories: coldMemories,
    links: coldLinks,
  });

  assert(needsLayout === true, "memoryGraphToGraphDataWithMeta needsLayout true (cache miss)");
  assert(coldGraph.nodes.length === 5, "cold graph has 5 nodes");
  assert(coldGraph.edges.length === 5, "cold graph has 5 edges");
  // Client placement cache: adapter uses seedNodePosition(id), not origin zeros.
  assert(
    coldGraph.nodes.every(
      (n) =>
        Number.isFinite(n.x) &&
        Number.isFinite(n.y) &&
        Math.abs(n.x) <= 200 &&
        Math.abs(n.y) <= 200
    ),
    "adapter seeds missing xy via seedNodePosition (finite, in seed range)"
  );
  const seedXs = new Set(coldGraph.nodes.map((n) => n.x));
  assert(
    seedXs.size > 1,
    "seedNodePosition yields distinct seeds across cold nodes"
  );
  // graphNeedsLayout is the all-at-origin collapse heuristic (legacy); seeds
  // intentionally avoid origin stack — settle uses explicit needsLayout flag.
  assert(
    !graphNeedsLayout(coldGraph),
    "seeded graph is not all-at-origin collapse (seeds spread)"
  );

  const coldRanks = new Map(coldGraph.nodes.map((n) => [n.id, n.rank]));
  const coldSettled = settleIfNeeded(coldGraph, {
    needsLayout: true,
    ticks: 400,
  });

  for (const n of coldSettled.nodes) {
    assert(
      Number.isFinite(n.x) && Number.isFinite(n.y),
      `cold-start finite ${n.id} (x=${n.x}, y=${n.y})`
    );
    assert(
      coldRanks.get(n.id) === n.rank,
      `cold-start rank unchanged for ${n.id}`
    );
  }

  const allNearOrigin = coldSettled.nodes.every(
    (n) => Math.abs(n.x) <= ORIGIN_EPSILON && Math.abs(n.y) <= ORIGIN_EPSILON
  );
  assert(
    !allNearOrigin,
    "cold-start settle: nodes not all within ORIGIN_EPSILON of origin"
  );

  const spread = maxPairwiseDistance(coldSettled.nodes);
  assert(
    spread > 1,
    `cold-start max pairwise distance > 1 (got ${spread.toFixed(4)})`
  );
  console.log(`  cold-start spread (max pairwise)=${spread.toFixed(2)}`);

  // settleIfNeeded no-op when needsLayout false and graph already placed.
  const noop = settleIfNeeded(settled, { needsLayout: false });
  assert(noop === settled, "settleIfNeeded returns same ref when needsLayout false");

  // --- Client placement cache hit + dirty-link fingerprint ----------------
  console.log("\n--- placement cache round-trip + dirty links ---");
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
  // Ensure window.localStorage is the same mock (force-recipe checks window).
  globalThis.window.localStorage = mockLs;

  const cacheMemories = [
    stubMemory({ id: "r", name: "R" }),
    stubMemory({ id: "c", name: "C" }),
  ];
  const cleanLinks = [{ source: "c", target: "r", type: "PART_OF" }];
  const dirtyLinks = [
    ...cleanLinks,
    // Dangling / unknown — must not change fingerprint vs clean filtered set.
    { source: "ghost", target: "r", type: "RELATES_TO" },
    { source: "c", target: "r", type: "PART_OF" }, // duplicate
  ];

  const firstMap = memoryGraphToGraphDataWithMeta({
    memories: cacheMemories,
    links: dirtyLinks,
  });
  assert(firstMap.needsLayout === true, "cold map with dirty links → needsLayout true");

  const settledCache = settleGraphData(firstMap.graph, { ticks: 200 });
  const settledById = new Map(settledCache.nodes.map((n) => [n.id, n]));

  const secondMap = memoryGraphToGraphDataWithMeta({
    memories: cacheMemories,
    links: dirtyLinks,
  });
  assert(
    secondMap.needsLayout === false,
    "after settle+save: dirty-link topology reloads as cache hit (needsLayout false)"
  );
  for (const n of secondMap.graph.nodes) {
    const s = settledById.get(n.id);
    assert(
      s != null && n.x === s.x && n.y === s.y && n.rank === s.rank,
      `cache hit pose equality for ${n.id}`
    );
  }

  const cleanMap = memoryGraphToGraphDataWithMeta({
    memories: cacheMemories,
    links: cleanLinks,
  });
  assert(
    cleanMap.needsLayout === false &&
      cleanMap.fingerprint === secondMap.fingerprint,
    "clean vs dirty input links share fingerprint after filter/dedupe"
  );

  // Static product path must not statically import d3-force (dynamic via layout-loop-d3).
  const layoutLoopSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/layout/layout-loop.ts"),
    "utf8"
  );
  assert(
    !/from\s+["']d3-force["']/.test(layoutLoopSrc) &&
      !/from\s+["'][^"']*force-recipe["']/.test(layoutLoopSrc) &&
      !/require\(["']d3-force["']\)/.test(layoutLoopSrc),
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
    "graph-canvas.tsx does not statically import d3-force / force-recipe"
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
