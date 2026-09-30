/**
 * Focused FalkorDBLite checks for manageLinks all-or-nothing atomicity.
 * Run: npx tsx scripts/verify-manage-links-atomic.mjs
 */
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Always allocate a unique test store; ignore inherited real-data paths.
// macOS TMPDIR can be deeply nested, so use its short system temp location.
const tempRoot = process.platform === "darwin" ? "/private/tmp" : tmpdir();
const dataDir = await mkdtemp(path.join(tempRoot, "spy-links-"));

process.env.FALKOR_PATH = dataDir;

try {
  const { createToolSet } = await import(
    pathToFileURL(path.join(root, "src/ai/tools/toolset.ts")).href
  );
  const { getDb } = await import(
    pathToFileURL(path.join(root, "src/lib/graph/falkor.ts")).href
  );

  const { subscribeToTopologyUpdates } = await import(
    pathToFileURL(path.join(root, "src/lib/graph/topology-events.ts")).href
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
    throw new Error("manageLinks.execute missing");
  }

  const toolOpts = {
    toolCallId: "verify-manage-links",
    messages: [],
    context: {},
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

  // falkor.ts is reads-only; seed core fields with direct Cypher (same
  // MERGE + SET the retired upsertMemory helper performed).
  async function seedMemory(memory) {
    const graph = await getDb();
    await graph.query(
      `
      MERGE (m:Memory {id: $id})
      SET m.name = $name,
          m.content = $content,
          m.impression = $impression,
          m.confidence = $confidence
      `,
      { params: memory },
    );
  }

  await seedMemory(mem("A", "A"));
  await seedMemory(mem("B", "B"));
  await seedMemory(mem("C", "C"));

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

  // Completed tool writes must stay successful even if SSE delivery fails.
  const deliveredUpdates = [];
  const stopBrokenSubscriber = subscribeToTopologyUpdates(() => {
    throw new Error("simulated closed SSE stream");
  });
  const stopHealthySubscriber = subscribeToTopologyUpdates((event) => {
    deliveredUpdates.push(event);
  });
  try {
    const linkResult = await runManage({
      remove: [],
      upsert: [{ source: "A", target: "B", type: "PARENT_OF" }],
    });
    assert(successBatches(linkResult, 0, 1), `link write survives subscriber failure: ${JSON.stringify(linkResult)}`);
    assert((await parentOf("B")).join() === "A", "successful link is committed despite subscriber failure");

    const memoryResult = await tools.upsertMemory.execute({ id: "A", name: "A updated" }, toolOpts);
    assert(
      memoryResult.error == null && memoryResult.id === "A" && memoryResult.name === "A updated",
      `memory write survives subscriber failure: ${JSON.stringify(memoryResult)}`,
    );
    const graph = await getDb();
    const persistedMemory = await graph.query("MATCH (m:Memory {id: 'A'}) RETURN m.name AS name");
    assert(persistedMemory.data[0]?.name === "A updated", "successful memory patch is committed despite subscriber failure");
    assert(deliveredUpdates.length === 2, "healthy subscriber receives both completed tool writes");
  } finally {
    stopBrokenSubscriber();
    stopHealthySubscriber();
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
    process.exitCode = 1;
  } else {
    console.log("\nverify-manage-links-atomic passed");
  }
} finally {
  // Close this process's embedded server before removing its test directory.
  try {
    await globalThis.__spyFalkor?.client?.close();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}
