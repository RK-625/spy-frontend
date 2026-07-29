/**
 * verify-placement-cache.mjs — Verification tests for Slice C2: Client rank + fingerprint + localStorage cache.
 *
 * Tests:
 * 1. deriveRanks: root=0, child=parent+1, cycle handling, orphan nodes.
 * 2. computeTopoFingerprint: deterministic output, change on topology edit.
 * 3. loadPlacementCache & savePlacementCache: storage read/write, cache hit on matching fingerprint, miss on mismatch.
 *
 * Run: npm run verify:placement-cache
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

function createMockLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, val) {
      store.set(key, String(val));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

async function main() {
  const placementCacheUrl = pathToFileURL(
    path.join(root, "src/lib/graph/placement-cache.ts")
  ).href;
  const placementCache = await import(placementCacheUrl);

  const {
    PLACEMENT_ALGO_VERSION,
    PLACEMENT_CACHE_STORAGE_KEY,
    deriveRanks,
    computeTopoFingerprint,
    loadPlacementCache,
    savePlacementCache,
  } = placementCache;

  // --------------------------------------------------------------------------
  // Test 1: deriveRanks
  // --------------------------------------------------------------------------
  console.log("\n--- Test 1: deriveRanks ---");
  const memories1 = [
    { id: "root" },
    { id: "child-a" },
    { id: "child-b" },
    { id: "leaf-a1" },
    { id: "orphan" },
  ];
  const links1 = [
    { source: "child-a", target: "root", type: "PART_OF" },
    { source: "child-b", target: "root", type: "PART_OF" },
    { source: "leaf-a1", target: "child-a", type: "PART_OF" },
    { source: "child-a", target: "child-b", type: "RELATES_TO" },
  ];

  const ranks1 = deriveRanks(memories1, links1);

  assert(ranks1.get("root") === 0, `root rank is 0 (got ${ranks1.get("root")})`);
  assert(
    ranks1.get("child-a") === 1,
    `child-a rank is 1 (got ${ranks1.get("child-a")})`
  );
  assert(
    ranks1.get("child-b") === 1,
    `child-b rank is 1 (got ${ranks1.get("child-b")})`
  );
  assert(
    ranks1.get("leaf-a1") === 2,
    `leaf-a1 rank is 2 (got ${ranks1.get("leaf-a1")})`
  );
  assert(
    ranks1.get("orphan") === 0,
    `orphan rank is 0 (got ${ranks1.get("orphan")})`
  );

  // Cycle handling in deriveRanks
  const cyclicMemories = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
  const cyclicLinks = [
    { source: "c1", target: "c2", type: "PART_OF" },
    { source: "c2", target: "c3", type: "PART_OF" },
    { source: "c3", target: "c1", type: "PART_OF" },
  ];
  const cyclicRanks = deriveRanks(cyclicMemories, cyclicLinks);
  assert(
    typeof cyclicRanks.get("c1") === "number" &&
      typeof cyclicRanks.get("c2") === "number" &&
      typeof cyclicRanks.get("c3") === "number",
    "cycle handling returns valid number ranks for all cyclic nodes without throwing/hanging"
  );

  // --------------------------------------------------------------------------
  // Test 2: computeTopoFingerprint
  // --------------------------------------------------------------------------
  console.log("\n--- Test 2: computeTopoFingerprint ---");
  const fp1 = computeTopoFingerprint(memories1, links1, ranks1);
  assert(typeof fp1 === "string" && fp1.length > 0, "fingerprint is non-empty string");
  assert(fp1.startsWith(`${PLACEMENT_ALGO_VERSION}|`), "fingerprint starts with algo version");

  // Re-ordered input should yield identical fingerprint
  const memories1Reordered = [
    { id: "orphan" },
    { id: "leaf-a1" },
    { id: "child-b" },
    { id: "child-a" },
    { id: "root" },
  ];
  const links1Reordered = [...links1].reverse();
  const fp1Reordered = computeTopoFingerprint(
    memories1Reordered,
    links1Reordered,
    ranks1
  );
  assert(
    fp1 === fp1Reordered,
    "computeTopoFingerprint is deterministic regardless of array ordering"
  );

  // Topology change yields different fingerprint
  const memoriesEdited = [...memories1, { id: "new-node" }];
  const ranksEdited = deriveRanks(memoriesEdited, links1);
  const fpEdited = computeTopoFingerprint(memoriesEdited, links1, ranksEdited);
  assert(
    fp1 !== fpEdited,
    "topology edit (added node) changes fingerprint"
  );

  // --------------------------------------------------------------------------
  // Test 3: loadPlacementCache & savePlacementCache
  // --------------------------------------------------------------------------
  console.log("\n--- Test 3: loadPlacementCache & savePlacementCache ---");
  const mockStorage = createMockLocalStorage();
  globalThis.window = globalThis.window || { localStorage: mockStorage };
  globalThis.localStorage = mockStorage;

  const mockNodes = {
    root: { x: 10, y: 20, rank: 0 },
    "child-a": { x: 100, y: 200, rank: 1 },
  };

  savePlacementCache(fp1, mockNodes);
  assert(
    mockStorage.getItem(PLACEMENT_CACHE_STORAGE_KEY) !== null,
    "savePlacementCache writes to storage key"
  );

  const loadedHits = loadPlacementCache(fp1);
  assert(
    loadedHits !== null && loadedHits["child-a"]?.x === 100,
    "loadPlacementCache hits on matching fingerprint"
  );

  const loadedMiss = loadPlacementCache("mismatched-fingerprint-123");
  assert(
    loadedMiss === null,
    "loadPlacementCache returns null on fingerprint mismatch"
  );

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll placement-cache checks passed successfully!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
