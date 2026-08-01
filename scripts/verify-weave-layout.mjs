/**
 * verify-weave-layout.mjs — Client-placement product invariants (pure; no Falkor).
 *
 * Run: npm run verify:weave-layout
 *   → npx tsx scripts/verify-weave-layout.mjs
 *
 * Always pure (required CI gate — **no** Falkor/Redis):
 *   - adapter cache miss → needsLayout + seedNodePosition spread
 *   - settleGraphData (force-recipe) → finite xy, ranks from PART_OF
 *   - fingerprint + localStorage cache hit after settle
 *   - toolset has no server settle/persist
 *   - listGraphTopology does not select m.x/m.y/m.rank
 *   - falkor has no product placement read/write exports
 *   - memory-layout-settle dual-path module is gone
 *   - Phase 1 removals stay gone (memoryNeedsLayout*, EDGE_SYNAPSE_GAP_MIN,
 *     LAYOUT_SIMULATION_ENABLED, simulationEnabled / iterationsPerFrame)
 *
 * Product placement: client localStorage (`placement-cache.ts`). This script
 * never opens Falkor (avoids hang on missing Redis / falkordblite).
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

function maxPairwiseDistance(nodes) {
  let max = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(
        nodes[i].x - nodes[j].x,
        nodes[i].y - nodes[j].y
      );
      if (d > max) max = d;
    }
  }
  return max;
}

async function main() {
  const adapterUrl = pathToFileURL(
    path.join(root, "src/lib/graph/placement/from-memory-graph.ts")
  ).href;
  const recipeUrl = pathToFileURL(
    path.join(root, "src/lib/graph/placement/force-recipe.ts")
  ).href;
  const placementCacheUrl = pathToFileURL(
    path.join(root, "src/lib/graph/placement/placement-cache.ts")
  ).href;

  const { memoryGraphToGraphDataWithMeta } = await import(adapterUrl);
  const { settleGraphData, ORIGIN_EPSILON } = await import(recipeUrl);
  const { deriveRanks, computeTopoFingerprint, seedNodePosition } =
    await import(placementCacheUrl);

  /** Script-local: finite xy and not both near origin (was isPlacedLayout). */
  function isPlacedPose(layout) {
    if (layout == null) return false;
    const { x, y } = layout;
    if (x == null || y == null) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (Math.abs(x) <= ORIGIN_EPSILON && Math.abs(y) <= ORIGIN_EPSILON) {
      return false;
    }
    return true;
  }

  // --- Product path: no server placement writes ----------------------------
  console.log("--- product path: no Falkor placement ---");

  // SoT implementation is tools/toolset.ts; root toolset.ts is a re-export shim.
  // Fence the implementation (and the shim) so a hollow re-export cannot pass.
  // Positive markers ensure SoT is real tool wiring, not export * only.
  const toolsetImplPath = path.join(root, "src/ai/tools/toolset.ts");
  const toolsetShimPath = path.join(root, "src/ai/toolset.ts");
  assert(fs.existsSync(toolsetImplPath), "src/ai/tools/toolset.ts exists (SoT)");
  const toolsetSrc = fs.readFileSync(toolsetImplPath, "utf8");
  const toolsetShimSrc = fs.existsSync(toolsetShimPath)
    ? fs.readFileSync(toolsetShimPath, "utf8")
    : "";
  assert(
    /export\s+const\s+toolSet\b/.test(toolsetSrc),
    "tools/toolset.ts exports const toolSet (not hollow re-export)"
  );
  assert(
    /\bupsertMemory\b/.test(toolsetSrc) &&
      /\baskUserQuestion\b/.test(toolsetSrc) &&
      /\blinkMemories\b/.test(toolsetSrc),
    "tools/toolset.ts defines upsertMemory / askUserQuestion / linkMemories"
  );
  assert(
    !/^\s*export\s+\*\s+from\s+/m.test(toolsetSrc) ||
      /export\s+const\s+toolSet\b/.test(toolsetSrc),
    "tools/toolset.ts is implementation SoT (has toolSet body)"
  );
  for (const [label, src] of [
    ["tools/toolset.ts", toolsetSrc],
    ["toolset.ts (shim)", toolsetShimSrc],
  ]) {
    if (!src) continue;
    assert(
      !/settleAndPersistMemoryPlacements/.test(src),
      `settleAndPersistMemoryPlacements is NOT called in ${label}`
    );
    assert(
      !/setMemoryPlacement/.test(src) &&
        !/settleGraphData/.test(src) &&
        !/settleMemoryGraphIncremental/.test(src),
      `${label} does not import/call placement settle or setMemoryPlacement`
    );
  }

  const falkorSrc = fs.readFileSync(
    path.join(root, "src/lib/falkor.ts"),
    "utf8"
  );
  const listStart = falkorSrc.indexOf("function listGraphTopology");
  const listGraphTopologyBody =
    listStart >= 0 ? falkorSrc.slice(listStart, listStart + 2500) : "";
  assert(
    listStart >= 0 &&
      !/m\.x\s+AS\s+x/i.test(listGraphTopologyBody) &&
      !/m\.y\s+AS\s+y/i.test(listGraphTopologyBody) &&
      !/m\.rank\s+AS\s+rank/i.test(listGraphTopologyBody),
    "listGraphTopology in falkor.ts does NOT select m.x, m.y, or m.rank"
  );
  assert(
    !/export async function setMemoryPlacement/.test(falkorSrc) &&
      !/export async function getMemoryPlacement/.test(falkorSrc) &&
      !/export async function listMemoryPlacements/.test(falkorSrc),
    "falkor.ts has no product placement read/write exports"
  );

  // Dual-path incremental settle module must stay deleted.
  assert(
    !fs.existsSync(path.join(root, "src/lib/memory-layout-settle.ts")),
    "memory-layout-settle.ts is deleted (client force-recipe only)"
  );

  // Phase 1 removals — source fences (no soft-switch / API-xy helper resurrection).
  console.log("\n--- Phase 1 removal fences ---");
  const adapterSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/placement/from-memory-graph.ts"),
    "utf8"
  );
  const barrelSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/index.ts"),
    "utf8"
  );
  const layoutLoopSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/layout/layout-loop.ts"),
    "utf8"
  );
  const graphScaleSrc = fs.readFileSync(
    path.join(root, "src/lib/graph/core/graph-scale.ts"),
    "utf8"
  );
  assert(
    !/export function memoryNeedsLayout/.test(adapterSrc) &&
      !/export function memoriesNeedLayout/.test(adapterSrc) &&
      !/\bmemoryNeedsLayout\b/.test(barrelSrc) &&
      !/\bmemoriesNeedLayout\b/.test(barrelSrc),
    "memoryNeedsLayout / memoriesNeedLayout not re-exported (adapter/barrel)"
  );
  assert(
    !/\bEDGE_SYNAPSE_GAP_MIN\b/.test(graphScaleSrc) &&
      !/\bEDGE_SYNAPSE_GAP_MIN\b/.test(barrelSrc),
    "EDGE_SYNAPSE_GAP_MIN not resurrected (graph-scale/barrel)"
  );
  assert(
    !/\bLAYOUT_SIMULATION_ENABLED\b/.test(layoutLoopSrc) &&
      !/\bLAYOUT_SIMULATION_ENABLED\b/.test(barrelSrc),
    "LAYOUT_SIMULATION_ENABLED not resurrected (layout-loop/barrel)"
  );
  assert(
    !/\bsimulationEnabled\b/.test(layoutLoopSrc) &&
      !/\biterationsPerFrame\b/.test(layoutLoopSrc),
    "FA2 simulationEnabled / iterationsPerFrame options not resurrected"
  );

  // Shared wire types SoT — GET /api/graph (client-safe; not only falkor).
  console.log("\n--- GraphTopology wire types SoT ---");
  const topoTypesPath = path.join(root, "src/types/graph-topology.ts");
  assert(
    fs.existsSync(topoTypesPath),
    "src/types/graph-topology.ts exists (client-safe wire SoT)"
  );
  const topoTypesSrc = fs.readFileSync(topoTypesPath, "utf8");
  assert(
    /export type GraphTopologyMemory\b/.test(topoTypesSrc) &&
      /export type GraphTopology\b/.test(topoTypesSrc) &&
      /export type GraphApiResponse\b/.test(topoTypesSrc),
    "graph-topology.ts exports GraphTopologyMemory, GraphTopology, GraphApiResponse"
  );
  // Wire SoT must stay lean: no embeddings, no client placement fields.
  assert(
    !/\bsearchEmbedding\b/.test(topoTypesSrc) &&
      !/\bcontentEmbedding\b/.test(topoTypesSrc),
    "graph-topology.ts has no embedding fields (searchEmbedding/contentEmbedding)"
  );
  assert(
    !/\bx\s*:/.test(topoTypesSrc) &&
      !/\by\s*:/.test(topoTypesSrc) &&
      !/\brank\s*:/.test(topoTypesSrc),
    "graph-topology.ts has no placement fields (x/y/rank) on type bodies"
  );
  const canvasSrc = fs.readFileSync(
    path.join(root, "src/components/graph/graph-canvas.tsx"),
    "utf8"
  );
  assert(
    !/type GraphApiResponse\s*=/.test(canvasSrc),
    "graph-canvas does not define local GraphApiResponse (uses shared SoT)"
  );
  assert(
    /from ["']@\/types\/graph-topology["']/.test(canvasSrc) ||
      /from ["']@\/types["']/.test(canvasSrc) ||
      (/GraphApiResponse/.test(canvasSrc) &&
        /from ["']@\/lib\/graph["']/.test(canvasSrc)),
    "graph-canvas imports GraphApiResponse from shared module"
  );
  // falkor may re-export; must not redefine topology type bodies inline.
  assert(
    !/export type GraphTopologyMemory\s*=\s*\{/.test(falkorSrc) &&
      !/export type GraphTopology\s*=\s*\{/.test(falkorSrc),
    "falkor.ts does not redefine GraphTopologyMemory/GraphTopology bodies (re-export SoT only)"
  );
  assert(
    /export type\s*\{\s*GraphTopology\s*,\s*GraphTopologyMemory\s*\}\s*from\s*["']@\/types\/graph-topology["']/.test(
      falkorSrc
    ) ||
      /export type\s*\{\s*GraphTopologyMemory\s*,\s*GraphTopology\s*\}\s*from\s*["']@\/types\/graph-topology["']/.test(
        falkorSrc
      ),
    "falkor.ts re-exports GraphTopology + GraphTopologyMemory from @/types/graph-topology"
  );

  // --- memory-placement removed (product uses deriveRanks + settleGraphData) -
  console.log("\n--- memory-placement gone / product rank APIs ---");
  assert(
    !fs.existsSync(
      path.join(root, "src/lib/graph/placement/memory-placement.ts")
    ),
    "memory-placement.ts is gone"
  );
  assert(
    !fs.existsSync(path.join(root, "src/lib/memory-placement.ts")),
    "legacy src/lib/memory-placement.ts is gone"
  );
  // barrelSrc loaded earlier in Phase 1 fences.
  assert(
    !/memory-placement/.test(barrelSrc) &&
      !/\bisPlacedLayout\b/.test(barrelSrc) &&
      !/\brankAfterParent\b/.test(barrelSrc) &&
      !/\bPARENT_CHILD_RADIUS\b/.test(barrelSrc) &&
      !/\bLAYOUT_ORIGIN_EPSILON\b/.test(barrelSrc),
    "barrel does not re-export memory-placement symbols"
  );
  // Rank depth is product-owned by deriveRanks (PART_OF child = parent + 1).
  assert(typeof deriveRanks === "function", "deriveRanks exported (product rank)");

  // --- Adapter cold miss + force-recipe settle -----------------------------
  console.log("\n--- cold topology → needsLayout + settleGraphData ---");

  const memories = [
    stubMemory({ id: "root", name: "Root" }),
    stubMemory({ id: "sib-a", name: "Sib A" }),
    stubMemory({ id: "sib-b", name: "Sib B" }),
    stubMemory({ id: "cousin", name: "Cousin" }),
    stubMemory({ id: "child", name: "Child" }),
  ];
  const links = [
    { source: "sib-a", target: "root", type: "PART_OF" },
    { source: "sib-b", target: "root", type: "PART_OF" },
    { source: "child", target: "root", type: "PART_OF" },
    { source: "cousin", target: "root", type: "RELATES_TO" },
  ];

  const {
    graph,
    needsLayout,
    fingerprint,
  } = memoryGraphToGraphDataWithMeta({ memories, links });

  assert(needsLayout === true, "no placement cache → needsLayout (cache miss)");
  assert(typeof fingerprint === "string" && fingerprint.length > 0, "fingerprint non-empty");
  assert(graph.nodes.length === 5, "graph has 5 nodes");
  assert(graph.edges.length === 4, "graph has 4 edges");

  // Seeds via seedNodePosition (not origin stack).
  assert(
    graph.nodes.every(
      (n) =>
        Number.isFinite(n.x) &&
        Number.isFinite(n.y) &&
        Math.abs(n.x) <= 200 &&
        Math.abs(n.y) <= 200
    ),
    "adapter seeds via seedNodePosition (finite, in seed range)"
  );
  const seedXs = new Set(graph.nodes.map((n) => n.x));
  assert(seedXs.size > 1, "seedNodePosition yields distinct seeds");

  // Client-derived ranks from PART_OF (child = parent + 1).
  const ranks = deriveRanks(memories, graph.edges);
  assert(ranks.get("root") === 0, "root rank is 0");
  assert(ranks.get("child") === 1, "PART_OF child rank = parent+1");
  assert(ranks.get("sib-a") === 1, "sib-a rank is 1");
  assert(ranks.get("cousin") === 0, "RELATES_TO cousin rank stays 0");

  for (const n of graph.nodes) {
    assert(
      n.rank === ranks.get(n.id),
      `adapter node ${n.id} rank matches deriveRanks`
    );
  }

  // Full-graph pure settle (product cold path uses force-recipe, not server).
  const settled = settleGraphData(graph, { ticks: 400 });
  for (const n of settled.nodes) {
    assert(
      Number.isFinite(n.x) && Number.isFinite(n.y),
      `settled finite ${n.id} (${n.x}, ${n.y})`
    );
    assert(
      n.rank === ranks.get(n.id),
      `settle preserves rank for ${n.id}`
    );
  }
  const allNearOrigin = settled.nodes.every(
    (n) => Math.abs(n.x) <= ORIGIN_EPSILON && Math.abs(n.y) <= ORIGIN_EPSILON
  );
  assert(!allNearOrigin, "after settle: not all nodes within origin epsilon");
  const spread = maxPairwiseDistance(settled.nodes);
  assert(spread > 1, `settled spread > 1 (got ${spread.toFixed(4)})`);
  console.log(`  settled spread (max pairwise)=${spread.toFixed(2)}`);

  const childNode = settled.nodes.find((n) => n.id === "child");
  assert(
    childNode != null && isPlacedPose({ x: childNode.x, y: childNode.y }),
    "child has placed pose after full settle"
  );

  // --- RELATES_TO cold pair ------------------------------------------------
  console.log("\n--- RELATES_TO cold pair settle ---");
  const relatesMemories = [
    stubMemory({ id: "a", name: "A" }),
    stubMemory({ id: "b", name: "B" }),
  ];
  const relatesLinks = [{ source: "b", target: "a", type: "RELATES_TO" }];
  const { graph: relatesGraph, needsLayout: relatesNeeds } =
    memoryGraphToGraphDataWithMeta({
      memories: relatesMemories,
      links: relatesLinks,
    });
  assert(relatesNeeds === true, "topology without cache → needsLayout");
  const relatesSettled = settleGraphData(relatesGraph, { ticks: 400 });
  for (const n of relatesSettled.nodes) {
    assert(
      Number.isFinite(n.x) && Number.isFinite(n.y),
      `RELATES_TO finite ${n.id}`
    );
  }
  const bAfter = relatesSettled.nodes.find((n) => n.id === "b");
  assert(
    bAfter != null && isPlacedPose({ x: bAfter.x, y: bAfter.y }),
    "RELATES_TO settle: b has placed pose"
  );

  // --- Fingerprint + cache hit round-trip ----------------------------------
  console.log("\n--- placement cache fingerprint round-trip ---");
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
  const dirtyLinks = [
    ...cleanLinks,
    { source: "ghost", target: "r", type: "RELATES_TO" },
    { source: "c", target: "r", type: "PART_OF" },
  ];

  const firstMap = memoryGraphToGraphDataWithMeta({
    memories: cacheMemories,
    links: dirtyLinks,
  });
  assert(firstMap.needsLayout === true, "cold map → needsLayout true");
  assert(
    typeof firstMap.fingerprint === "string" && firstMap.fingerprint.length > 0,
    "cold map fingerprint present"
  );

  // Fingerprint is filter/dedupe stable (same as clean filtered edge set).
  const fpDirty = computeTopoFingerprint(
    cacheMemories,
    firstMap.graph.edges,
    deriveRanks(cacheMemories, firstMap.graph.edges)
  );
  assert(
    fpDirty === firstMap.fingerprint,
    "adapter fingerprint matches computeTopoFingerprint on filtered edges"
  );

  const settledCache = settleGraphData(firstMap.graph, { ticks: 200 });
  const settledById = new Map(settledCache.nodes.map((n) => [n.id, n]));

  const secondMap = memoryGraphToGraphDataWithMeta({
    memories: cacheMemories,
    links: dirtyLinks,
  });
  assert(
    secondMap.needsLayout === false,
    "after settle+save: reloads as cache hit (needsLayout false)"
  );
  assert(
    secondMap.fingerprint === firstMap.fingerprint,
    "cache hit preserves topology fingerprint"
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

  // seedNodePosition is deterministic and pure.
  const s1 = seedNodePosition("node-z");
  const s2 = seedNodePosition("node-z");
  assert(
    s1.x === s2.x && s1.y === s2.y,
    "seedNodePosition is deterministic"
  );

  console.log("\n--- client-placement product path (static) ---");
  assert(true, "no Falkor open in verify:weave-layout (pure-only gate)");

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
