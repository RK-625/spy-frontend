/**
 * Diagnostic Q↔Q ANN probe for stored MemoryQuestion texts.
 *
 * Run:
 *   npx tsx scripts/probe-search-memories.mjs
 *   npm run probe:search-memories
 *
 * Edit SEARCH_QUESTIONS in this file. Mirrors product searchMemories →
 * generateEmbedding → vectorSearchByQuestions (same index, Cypher ANN,
 * cosine-distance ceiling, best-Memory, topK) but RETURNS the matching
 * MemoryQuestion.text. Does not change product search in src/.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const GRAPH_NAME = "spy_brain";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(SCRIPT_PATH), "..");

const SEARCH_QUESTIONS = [
  "Has the user studied abstract classes in Java?",
  "Has the user studied abstraction in Java?",
  "Has the user studied encapsulation in Java?",
  "Has the user studied inheritance in Java?",
  "Has the user studied interfaces in Java?",
  "Has the user studied polymorphism in Java?",
  "Has the user studied load balancing?",
  "Does the user know about distributing traffic across servers?",
  "Has the user learned about system design scaling concepts?",
  "Is the user familiar with high availability in distributed systems?"
];

/** Load KEY=VALUE env file; never overwrite keys already on process.env. */
function applyEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if (
      (quote === '"' || quote === "'") &&
      value.length >= 2 &&
      value[value.length - 1] === quote
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function trimProbes(values) {
  return values
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
}

function newestFalkorSocket(dir) {
  if (!existsSync(dir)) return null;
  /** @type {{ full: string, mtimeMs: number }[]} */
  const socks = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith("fdb-") || !name.endsWith(".sock")) continue;
    const full = path.join(dir, name);
    try {
      const st = statSync(full);
      if (!st.isSocket() && !st.isFile()) continue;
      socks.push({ full, mtimeMs: st.mtimeMs });
    } catch {
      continue;
    }
  }
  if (socks.length === 0) return null;
  socks.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return socks[0].full;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asString(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * @param {unknown} row
 */
function normalizeAnnRow(row) {
  if (!row || typeof row !== "object") return null;
  const rec = /** @type {Record<string, unknown>} */ (row);
  const score = asNumber(rec.score);
  if (!Number.isFinite(score)) return null;
  return {
    questionId: asString(rec.questionId),
    questionText: asString(rec.questionText),
    id: asString(rec.id),
    name: asString(rec.name),
    score,
  };
}

/**
 * Product filter: skip score > MEMORY_SEARCH_MAX_DISTANCE (distance; 0 =
 * identical), best (smallest) distance per Memory id, sort ascending, slice
 * topK. Winning question stays on the survivor.
 *
 * @param {ReturnType<typeof normalizeAnnRow>[]} rawHits
 * @param {number} maxDistance
 * @param {number} topK
 */
function productSurvivors(rawHits, maxDistance, topK) {
  /** @type {Map<string, NonNullable<ReturnType<typeof normalizeAnnRow>>>} */
  const bestByMemoryId = new Map();
  for (const row of rawHits) {
    if (row == null || row.score > maxDistance) continue;
    const prior = bestByMemoryId.get(row.id);
    if (prior == null || row.score < prior.score) {
      bestByMemoryId.set(row.id, row);
    }
  }
  return Array.from(bestByMemoryId.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, topK);
}

function formatScore(score) {
  return score.toFixed(3);
}

function printHuman(probeIndex, probe, survivors, otherHits) {
  console.log(`=== probe ${probeIndex} ===`);
  console.log(probe);
  console.log("");
  console.log("  survivors (product distance ceiling + best Memory):");
  if (survivors.length === 0) {
    console.log(
      "    (none — empty inner list = miss, same as searchMemories)",
    );
  } else {
    for (const hit of survivors) {
      console.log(
        `    ${formatScore(hit.score)}  ${hit.name}  [${hit.id}]`,
      );
      console.log(`           Q: ${hit.questionText}`);
    }
  }
  console.log("");
  console.log("  other ANN hits (same probe, not chosen / extra questions):");
  if (otherHits.length === 0) {
    console.log("    (none)");
  } else {
    for (const hit of otherHits) {
      console.log(
        `    ${formatScore(hit.score)}  ${hit.name}  [${hit.id}]`,
      );
      console.log(`           Q: ${hit.questionText}`);
    }
  }
  console.log("");
}

async function attachViaSocket(sockPath) {
  const { FalkorDB } = await import("falkordb");
  try {
    const client = await FalkorDB.connect({
      socket: { path: sockPath, connectTimeout: 4000 },
    });
    const graph = client.selectGraph(GRAPH_NAME);
    return {
      graph,
      close: async () => {
        await client.close();
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to attach to existing Falkor unix socket:\n  ${sockPath}\n` +
        `Likely lock / stale socket / the app is using the DB.\n` +
        `Not opening a second lite instance on the same data dir.\n${message}`,
    );
    process.exit(1);
  }
}

async function openEmbeddedGraph() {
  console.error(
    "No fdb-*.sock under FALKOR_PATH; using product getDb() (starts/opens embedded FalkorDBLite).",
  );
  const { getDb } = await import(
    pathToFileURL(path.join(root, "src/lib/falkor.ts")).href
  );
  const graph = await getDb();
  return { graph, close: null };
}

async function runAnnQuery(graph, embedding, topK) {
  const cypher = `
    CALL db.idx.vector.queryNodes('MemoryQuestion', 'questionEmbedding', $topK, vecf32($embedding))
    YIELD node, score
    MATCH (node)-[:FOR_MEMORY]->(m:Memory)
    RETURN node.id AS questionId,
           node.text AS questionText,
           m.id AS id,
           m.name AS name,
           score
  `;
  const params = { params: { topK, embedding } };
  if (typeof graph.roQuery === "function") {
    return graph.roQuery(cypher, params);
  }
  return graph.query(cypher, params);
}

async function main() {
  process.chdir(root);
  if (!process.env.FALKOR_PATH) {
    process.env.FALKOR_PATH = path.join(root, ".data/falkor");
  }

  applyEnvFile(path.join(root, ".env"));
  applyEnvFile(path.join(root, ".env.local"));

  const probes = trimProbes(SEARCH_QUESTIONS);
  if (probes.length === 0) {
    console.error(
      "SEARCH_QUESTIONS is empty. Add at least one search string in this file.",
    );
    process.exit(1);
  }

  const falkorPath = path.resolve(process.env.FALKOR_PATH);
  const sockPath = newestFalkorSocket(falkorPath);

  const { MEMORY_SEARCH_TOP_K, MEMORY_SEARCH_MAX_DISTANCE } = await import(
    pathToFileURL(path.join(root, "src/lib/policy-tokens.ts")).href
  );
  const { generateEmbedding } = await import(
    pathToFileURL(path.join(root, "src/ai/models/embeddings.ts")).href
  );

  const session = sockPath
    ? await attachViaSocket(sockPath)
    : await openEmbeddedGraph();

  const topK = MEMORY_SEARCH_TOP_K;
  const maxDistance = MEMORY_SEARCH_MAX_DISTANCE;

  try {
    let probeIndex = 0;
    for (const probe of probes) {
      probeIndex += 1;
      let embedding;
      try {
        embedding = await generateEmbedding(probe);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `Embedding failed (check GOOGLE_GENERATIVE_AI_API_KEY / Google provider env): ${message}`,
        );
        process.exit(1);
      }

      let result;
      try {
        result = await runAnnQuery(session.graph, embedding, topK);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`ANN query failed: ${message}`);
        process.exit(1);
      }

      const rawHits = (result?.data ?? [])
        .map(normalizeAnnRow)
        .filter((row) => row != null);

      const survivors = productSurvivors(rawHits, maxDistance, topK);
      const survivorKeys = new Set(
        survivors.map((s) => `${s.id}\0${s.questionId}`),
      );

      const otherHits = rawHits.filter(
        (row) =>
          row.score <= maxDistance &&
          !survivorKeys.has(`${row.id}\0${row.questionId}`),
      );

      printHuman(probeIndex, probe, survivors, otherHits);
    }
  } finally {
    if (session.close) {
      await session.close();
    }
  }
}

await main();
