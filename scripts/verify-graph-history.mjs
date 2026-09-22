/**
 * Focused checks for graph-history persistence and the graph-events SSE route:
 * - replaceGraphMessages persists the blob without bumping updated_at
 *   (background writes must not reorder Recents), while replaceChatMessages
 *   still bumps it.
 * - GET graph-events streams 200 + empty snapshot for an unpersisted chat id
 *   (client mints the id before first persist; no 404 retry storm).
 * - GET replays the stored blob and delivers live publishes after the snapshot.
 * Run: npx tsx scripts/verify-graph-history.mjs
 */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Isolate before importing @/lib/chats/sqlite (process singleton). Never use product .data/chats.db.
let tempDbPath = process.env.CHATS_DB_PATH;
const isDefaultOrUnset =
  !tempDbPath ||
  tempDbPath === ".data/chats.db" ||
  tempDbPath.endsWith("/.data/chats.db");

/** Only unlink files this process created — never a caller-supplied CHATS_DB_PATH. */
let createdTempDb = false;

if (isDefaultOrUnset) {
  tempDbPath = path.join(
    tmpdir(),
    `chats-graph-verify-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  process.env.CHATS_DB_PATH = tempDbPath;
  createdTempDb = true;
}

function cleanupTempDb() {
  if (!createdTempDb || !tempDbPath) return;
  try {
    rmSync(tempDbPath, { force: true });
    rmSync(`${tempDbPath}-wal`, { force: true });
    rmSync(`${tempDbPath}-shm`, { force: true });
  } catch {
    // Ignore cleanup error
  }
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

const readFirstChunk = async (res) => {
  const reader = res.body.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  return new TextDecoder().decode(value);
};

try {
  const {
    createChatRecord,
    getChat,
    getChatWithMessages,
    replaceChatMessages,
    replaceGraphMessages,
  } = await import(pathToFileURL(path.join(root, "src/lib/chats/sqlite.ts")).href);

  const { GET } = await import(
    pathToFileURL(
      path.join(root, "src/app/api/chats/[chatId]/graph-events/route.ts"),
    ).href
  );

  const { publishGraphUpdate } = await import(
    pathToFileURL(path.join(root, "src/lib/chats/graph-events.ts")).href
  );

  const id = `test-graph-${Date.now()}`;
  const chat = createChatRecord({ id, title: "Graph Verify", messages: [] });

  // H1: user-facing chat writes still bump updated_at (Recents order).
  replaceChatMessages(id, [
    { id: "msg-1", role: "user", parts: [{ type: "text", text: "hi" }] },
  ]);
  assert(
    getChat(id).updated_at >= chat.updated_at,
    "H1: replaceChatMessages bumps updated_at",
  );

  // H2: background graph writes persist the blob but keep updated_at.
  await new Promise((r) => setTimeout(r, 5));
  const before = getChat(id).updated_at;
  replaceGraphMessages(id, [{ role: "user", content: "hello" }]);
  const row = getChatWithMessages(id);
  assert(
    row.updated_at === before,
    `H2: replaceGraphMessages keeps updated_at (${before} === ${row.updated_at})`,
  );
  assert(
    row.graph_messages.length === 1,
    "H2: graph blob persisted",
  );

  // H3: unpersisted chat id streams 200 + empty snapshot, not 404.
  const missingId = `never-seen-${Date.now()}`;
  const missing = await GET(
    new Request("http://verify.invalid/"),
    { params: Promise.resolve({ chatId: missingId }) },
  );
  assert(missing.status === 200, `H3: missing chat -> 200 (got ${missing.status})`);
  const firstMissing = await readFirstChunk(missing);
  assert(
    firstMissing.includes('"messages":[]') &&
      firstMissing.includes(`"chatId":"${missingId}"`),
    "H3: missing chat -> empty snapshot carrying chatId",
  );

  // H4: persisted chat replays the stored blob with its chatId.
  const existing = await GET(
    new Request("http://verify.invalid/"),
    { params: Promise.resolve({ chatId: id }) },
  );
  const firstExisting = await readFirstChunk(existing);
  assert(
    firstExisting.includes("hello") && firstExisting.includes(`"chatId":"${id}"`),
    "H4: existing chat -> snapshot replays stored blob",
  );

  // H5: a publish after the snapshot is delivered (subscription path works).
  const live = await GET(
    new Request("http://verify.invalid/"),
    { params: Promise.resolve({ chatId: id }) },
  );
  const reader = live.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const readEvent = async () => {
    for (;;) {
      const end = buf.indexOf("\n\n");
      if (end !== -1) {
        const out = buf.slice(0, end);
        buf = buf.slice(end + 2);
        return out;
      }
      const { value, done } = await reader.read();
      if (done) return null;
      buf += decoder.decode(value, { stream: true });
    }
  };
  await readEvent(); // initial snapshot
  publishGraphUpdate(id, [{ role: "assistant", content: "update!" }]);
  const second = await readEvent();
  await reader.cancel();
  assert(
    second !== null && second.includes("update!"),
    "H5: live publish delivered after snapshot",
  );
} finally {
  cleanupTempDb();
}

if (failed > 0) {
  console.error(`verify-graph-history failed: ${failed} check(s)`);
  process.exitCode = 1;
} else {
  console.log("verify-graph-history passed");
}
