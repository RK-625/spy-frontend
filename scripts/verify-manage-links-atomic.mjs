/**
 * Focused FalkorDBLite checks for manageLinks all-or-nothing atomicity.
 * Run: FALKOR_PATH=.data/falkor-manage-links-atomic npx tsx scripts/verify-manage-links-atomic.mjs
 */
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".data/falkor-manage-links-atomic");

process.env.FALKOR_PATH = dataDir;
await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });

const { createToolSet } = await import(
  pathToFileURL(path.join(root, "src/ai/tools/toolset.ts")).href
);
const { upsertMemory, getDb } = await import(
  pathToFileURL(path.join(root, "src/lib/falkor.ts")).href
);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

async function parentOf(childId) {
  const graph = await getDb();
  const result = await graph.query(
    `
    MATCH (p)-[:PARENT_OF]->(c:Memory {id: $childId})
    RETURN p.id AS parent
    `,
    { params: { childId } },
  );
  return result.data.map((row) => row.parent);
}

const tools = createToolSet();
const manageLinks = tools.manageLinks;
if (typeof manageLinks.execute !== "function") {
  console.error("manageLinks.execute missing");
  process.exit(1);
}

const toolOpts = {
  toolCallId: "verify-manage-links",
  messages: [],
};

async function runManage(input) {
  return manageLinks.execute(input, toolOpts);
}

const mem = (id, name) => ({
  id,
  name,
  content: name,
  impression: "test",
  confidence: 0.5,
});

await upsertMemory(mem("A", "A"));
await upsertMemory(mem("B", "B"));
await upsertMemory(mem("C", "C"));

function batchAllOk(batch, expectedTotal) {
  return (
    batch != null &&
    batch.succeeded === expectedTotal &&
    batch.total === expectedTotal &&
    Array.isArray(batch.results) &&
    batch.results.length === expectedTotal &&
    batch.results.every((item) => item.ok === true)
  );
}

function successBatches(r, removeTotal, upsertTotal) {
  return (
    r.error == null &&
    batchAllOk(r.remove, removeTotal) &&
    batchAllOk(r.upsert, upsertTotal)
  );
}

function failureErrorOnly(r) {
  return (
    typeof r.error === "string" &&
    r.error.length > 0 &&
    r.remove == null &&
    r.upsert == null
  );
}

// Seed A -PARENT_OF-> B
{
  const r = await runManage({
    remove: [],
    upsert: [{ source: "A", target: "B", type: "PARENT_OF" }],
  });
  assert(successBatches(r, 0, 1), `seed PARENT_OF: ${JSON.stringify(r)}`);
  assert(r.upsert.results[0].source === "A", "seed upsert has A→B");
  assert(
    (await parentOf("B")).join() === "A",
    "seed: A parents B",
  );
}

// Happy reparent: remove A→B, upsert C→B
{
  const r = await runManage({
    remove: [{ source: "A", target: "B", type: "PARENT_OF" }],
    upsert: [{ source: "C", target: "B", type: "PARENT_OF" }],
  });
  assert(successBatches(r, 1, 1), `happy reparent: ${JSON.stringify(r)}`);
  assert(
    r.remove.results[0].source === "A" && r.upsert.results[0].source === "C",
    "reparent batches: remove A then upsert C",
  );
  assert((await parentOf("B")).join() === "C", "happy reparent: C parents B");
}

// Reparent with missing new parent — must keep C
{
  const r = await runManage({
    remove: [{ source: "C", target: "B", type: "PARENT_OF" }],
    upsert: [{ source: "MISSING", target: "B", type: "PARENT_OF" }],
  });
  assert(failureErrorOnly(r), `missing parent error-only: ${JSON.stringify(r)}`);
  assert(
    String(r.error).includes("all-or-nothing") ||
      String(r.error).includes("not found"),
    `missing parent error mentions failure: ${r.error}`,
  );
  assert(
    String(r.error).includes("not found"),
    `missing parent error mentions not found: ${r.error}`,
  );
  assert((await parentOf("B")).join() === "C", "missing parent: C still parents B");
}

// Upsert-only second parent reject
{
  const r = await runManage({
    remove: [],
    upsert: [{ source: "A", target: "B", type: "PARENT_OF" }],
  });
  assert(failureErrorOnly(r), `sticky error-only: ${JSON.stringify(r)}`);
  assert(
    String(r.error).includes("already has a PARENT_OF parent"),
    `sticky error text: ${r.error}`,
  );
  assert((await parentOf("B")).join() === "C", "sticky reject: C still parents B");
}

// Remove-only allowed
{
  const r = await runManage({
    remove: [{ source: "C", target: "B", type: "PARENT_OF" }],
    upsert: [],
  });
  assert(successBatches(r, 1, 0), `remove-only: ${JSON.stringify(r)}`);
  assert(
    r.remove.results.length === 1 && r.remove.results[0].ok === true,
    "remove-only batch",
  );
  assert((await parentOf("B")).length === 0, "remove-only: B has no parent");
}

// Absent remove is success no-op
{
  const r = await runManage({
    remove: [{ source: "A", target: "B", type: "PARENT_OF" }],
    upsert: [],
  });
  assert(successBatches(r, 1, 0), `absent remove no-op: ${JSON.stringify(r)}`);
}

if (failed > 0) {
  console.error(`\nverify-manage-links-atomic failed (${failed})`);
  process.exit(1);
}
console.log("\nverify-manage-links-atomic passed");
process.exit(0);
