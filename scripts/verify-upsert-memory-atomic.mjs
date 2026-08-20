/**
 * Focused FalkorDBLite checks for upsertMemory all-or-nothing atomicity.
 * Run: npx tsx scripts/verify-upsert-memory-atomic.mjs
 *
 * Tool execute: missing-id + impression-only (no questions → no live embed).
 * Question create/replace atomicity: getDb + script-local dummy 1536-d vectors
 * (does not mock product embeddings.ts).
 */
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".data/falkor-upsert-memory-atomic");
const EMBEDDING_DIMENSION = 1536;

process.env.FALKOR_PATH = dataDir;
await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });

const { createToolSet } = await import(
  pathToFileURL(path.join(root, "src/ai/tools/toolset.ts")).href
);
const { getDb } = await import(
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

const tools = createToolSet();
const upsertMemory = tools.upsertMemory;
if (typeof upsertMemory.execute !== "function") {
  console.error("upsertMemory.execute missing");
  process.exit(1);
}

const toolOpts = {
  toolCallId: "verify-upsert-memory",
  messages: [],
};

async function runUpsert(input) {
  return upsertMemory.execute(input, toolOpts);
}

/** Script-local dummy vectors only — not product embeddings. */
function dummyEmbedding(seed) {
  const out = new Array(EMBEDDING_DIMENSION);
  let h = 2166136261 ^ seed;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    h = Math.imul(h ^ (i + 1), 16777619);
    out[i] = (h >>> 0) / 4294967295;
  }
  return out;
}

function probes(prefix, count = 5) {
  return Array.from({ length: count }, (_, i) => `${prefix} probe ${i + 1}`);
}

/** Mirrors toolset memoryQuestionCreateCypher(rows, memoryId) shape for getDb tests. */
function memoryQuestionCreateCypher(rows, memoryId) {
  const params = { memoryId };
  const createClauses = rows.map((row, index) => {
    const idKey = `q${index}_id`;
    const textKey = `q${index}_text`;
    const embKey = `q${index}_emb`;
    params[idKey] = row.id;
    params[textKey] = row.text;
    params[embKey] = row.questionEmbedding;
    return `
      CREATE (mq${index}:MemoryQuestion {
        id: $${idKey},
        text: $${textKey},
        questionEmbedding: vecf32($${embKey})
      })-[:FOR_MEMORY]->(mqMem)`;
  });
  return {
    cypher: `
      MATCH (mqMem:Memory {id: $memoryId})
      ${createClauses.join("\n")}`,
    params,
  };
}

function questionRows(texts) {
  return texts.map((text, index) => ({
    id: randomUUID(),
    text,
    questionEmbedding: dummyEmbedding(index + 1),
  }));
}

async function questionTexts(memoryId) {
  const graph = await getDb();
  const result = await graph.query(
    `
    MATCH (q:MemoryQuestion)-[:FOR_MEMORY]->(m:Memory {id: $memoryId})
    RETURN q.text AS text
    ORDER BY q.text
    `,
    { params: { memoryId } },
  );
  return (result.data ?? []).map((row) => row.text);
}

async function memoryExists(memoryId) {
  const graph = await getDb();
  const result = await graph.query(
    `
    MATCH (m:Memory {id: $memoryId})
    RETURN m.id AS id, m.name AS name, m.impression AS impression, m.confidence AS confidence
    `,
    { params: { memoryId } },
  );
  return result.data?.[0] ?? null;
}

function failureErrorOnly(r) {
  return typeof r.error === "string" && r.error.length > 0 && r.id == null;
}

// getDb: create Memory + questions in one GRAPH.QUERY (script-local dummy vectors)
let createdId = null;
{
  const graph = await getDb();
  const id = randomUUID();
  const questions = probes("create");
  const rows = questionRows(questions);
  const questionWrite = memoryQuestionCreateCypher(rows, id);
  await graph.query(
    `
    CREATE (m:Memory {
      id: $id,
      name: $name,
      content: $content,
      impression: $impression,
      confidence: $confidence
    })
    WITH m
    ${questionWrite.cypher}
    RETURN m.id AS id
    `,
    {
      params: {
        id,
        name: "Atomic Create",
        content: "Create path content",
        impression: "solid",
        confidence: 0.7,
        ...questionWrite.params,
      },
    },
  );
  createdId = id;
  const row = await memoryExists(createdId);
  assert(row?.name === "Atomic Create", "create: Memory core exists");
  const stored = await questionTexts(createdId);
  assert(
    stored.length === questions.length,
    `create: question count ${stored.length} === ${questions.length}`,
  );
  assert(
    questions.every((q) => stored.includes(q)),
    "create: all probe texts stored",
  );
}

// Tool: patch missing id → error, no write (no questions → no embed)
{
  const missingId = "missing-memory-id-atomic";
  const r = await runUpsert({
    id: missingId,
    impression: "should not write",
  });
  assert(failureErrorOnly(r), `patch missing error-only: ${JSON.stringify(r)}`);
  assert(
    String(r.error).includes("Memory not found"),
    `patch missing mentions not found: ${r.error}`,
  );
  assert(
    (await memoryExists(missingId)) == null,
    "patch missing: no Memory written",
  );
}

// getDb: patch name + replace questions in one GRAPH.QUERY
if (createdId) {
  const graph = await getDb();
  const nextQuestions = probes("patch-name");
  const rows = questionRows(nextQuestions);
  const questionWrite = memoryQuestionCreateCypher(rows, createdId);
  await graph.query(
    `
    MATCH (m:Memory {id: $id})
    SET m += $props
    WITH m
    OPTIONAL MATCH (m)<-[:FOR_MEMORY]-(oldq:MemoryQuestion)
    DETACH DELETE oldq
    WITH DISTINCT m
    ${questionWrite.cypher}
    RETURN m.id AS id, m.name AS name
    `,
    {
      params: {
        id: createdId,
        props: {
          name: "Atomic Patched",
          content: "Patched content",
        },
        ...questionWrite.params,
      },
    },
  );
  const row = await memoryExists(createdId);
  assert(row?.name === "Atomic Patched", "patch: name updated");
  const stored = await questionTexts(createdId);
  assert(
    stored.length === nextQuestions.length &&
      nextQuestions.every((q) => stored.includes(q)),
    "patch: probes fully replaced",
  );
  assert(
    !stored.some((t) => t.startsWith("create ")),
    "patch: old create probes gone",
  );
}

// Tool: impression-only (no questions → no embed); questions unchanged
if (createdId) {
  const before = await questionTexts(createdId);
  const r = await runUpsert({
    id: createdId,
    impression: "impression only",
    confidence: 0.2,
  });
  assert(
    r.error == null && r.id === createdId && r.questionCount == null,
    `impression-only result: ${JSON.stringify(r)}`,
  );
  const row = await memoryExists(createdId);
  assert(
    row?.impression === "impression only" && row?.confidence === 0.2,
    "impression-only: core fields updated",
  );
  const after = await questionTexts(createdId);
  assert(
    before.length === after.length && before.every((t, i) => t === after[i]),
    "impression-only: questions unchanged",
  );
}

// Source: one-query path + memoryQuestionCreateCypher(rows, memoryId); no falkorSetMemoryQuestions
{
  const { readFileSync } = await import("node:fs");
  const toolset = readFileSync(
    path.join(root, "src/ai/tools/toolset.ts"),
    "utf8",
  );
  assert(
    !toolset.includes("falkorSetMemoryQuestions") &&
      !toolset.includes("falkorUpsertMemory") &&
      !toolset.includes("falkorPatchMemory"),
    "toolset no longer splits via falkor upsert/patch/setQuestions",
  );
  assert(
    toolset.includes("all-or-nothing") && toolset.includes("getDb()"),
    "upsertMemory uses getDb all-or-nothing path",
  );
  assert(
    /function memoryQuestionCreateCypher\(\s*rows:\s*MemoryQuestion\[\],\s*memoryId:\s*string/.test(
      toolset,
    ),
    "memoryQuestionCreateCypher(rows, memoryId) signature",
  );
  assert(
    toolset.includes("memoryQuestionCreateCypher(rows, id)") &&
      toolset.includes("memoryQuestionCreateCypher(rows, input.id)"),
    "create/patch call memoryQuestionCreateCypher with memory id, not Cypher var",
  );
  assert(
    !toolset.includes('memoryQuestionCreateCypher(rows, "m")'),
    "toolset no longer passes Cypher variable name to memoryQuestionCreateCypher",
  );
}

if (failed > 0) {
  console.error(`\nverify-upsert-memory-atomic failed (${failed})`);
  process.exit(1);
}
console.log("\nverify-upsert-memory-atomic passed");
process.exit(0);
