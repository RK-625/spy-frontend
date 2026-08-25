/**
 * Run:
 *   npx tsx scripts/list-memory-questions.mjs
 *   npm run list:memory-questions
 * Diagnostic only. Does not change product search/write in src/.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const GRAPH_NAME = "spy_brain";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(SCRIPT_PATH), "..");

const LIST_QUESTIONS_CYPHER = `
MATCH (q:MemoryQuestion)-[:FOR_MEMORY]->(m:Memory)
RETURN q.text AS questionText, m.name AS memoryName
`;

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
 * @param {unknown} row
 * @returns {{ questionText: string, memoryName: string } | null}
 */
function normalizeQuestionRow(row) {
  if (!row || typeof row !== "object") return null;
  const rec = /** @type {Record<string, unknown>} */ (row);
  if (typeof rec.questionText !== "string") return null;
  const questionText = rec.questionText.trim();
  if (questionText.length === 0) return null;
  const memoryName = asString(rec.memoryName).trim();
  return { questionText, memoryName };
}

/**
 * @param {{ questionText: string, memoryName: string }[]} rows
 */
function printQuestionTable(rows) {
  console.table(
    rows.map((row) => ({
      "question.text": row.questionText,
      "memory.name": row.memoryName,
    })),
  );
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

async function listMemoryQuestions(graph) {
  const params = { params: {} };
  if (typeof graph.roQuery === "function") {
    return graph.roQuery(LIST_QUESTIONS_CYPHER, params);
  }
  return graph.query(LIST_QUESTIONS_CYPHER, params);
}

async function main() {
  process.chdir(root);
  if (!process.env.FALKOR_PATH) {
    process.env.FALKOR_PATH = path.join(root, ".data/falkor");
  }

  applyEnvFile(path.join(root, ".env"));
  applyEnvFile(path.join(root, ".env.local"));

  const falkorPath = path.resolve(process.env.FALKOR_PATH);
  const sockPath = newestFalkorSocket(falkorPath);

  const session = sockPath
    ? await attachViaSocket(sockPath)
    : await openEmbeddedGraph();

  try {
    let result;
    try {
      result = await listMemoryQuestions(session.graph);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`MemoryQuestion list query failed: ${message}`);
      process.exit(1);
    }

    const rows = (result?.data ?? [])
      .map(normalizeQuestionRow)
      .filter((row) => row != null)
      .sort((a, b) => {
        const byMemory = a.memoryName.localeCompare(b.memoryName);
        if (byMemory !== 0) return byMemory;
        return a.questionText.localeCompare(b.questionText);
      });

    if (rows.length === 0) {
      console.log("No MemoryQuestion → Memory rows in the graph.");
    } else {
      printQuestionTable(rows);
    }
  } finally {
    if (session.close) {
      await session.close();
    }
  }

  process.exit(0);
}

await main();
