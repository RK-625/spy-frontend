/**
 * Focused SQLite checks for deleteChatRecord.
 * Run: npx tsx scripts/verify-chat-delete.mjs
 */
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Isolate before importing @/lib/chats (process singleton). Never use product .data/chats.db.
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
    `chats-delete-verify-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
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

try {
  const {
    createChatRecord,
    deleteChatRecord,
    getChat,
    getChatsDb,
    listChats,
  } = await import(
    pathToFileURL(path.join(root, "src/lib/chats.ts")).href
  );

  // Case 1: createChatRecord then deleteChatRecord(id) -> true; getChat(id) -> null
  const id1 = `test-chat-1-${Date.now()}`;
  createChatRecord({
    id: id1,
    title: "Test Chat 1",
    messages: [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello from test 1" }],
      },
    ],
  });
  assert(getChat(id1) !== null, "Case 1: Chat 1 created in DB");
  const del1 = deleteChatRecord(id1);
  assert(del1 === true, "Case 1: deleteChatRecord returned true on existing row");
  assert(getChat(id1) === null, "Case 1: getChat returns null after delete");

  // Case 2: deleteChatRecord on the same id again -> false (idempotent, no throw)
  const del2 = deleteChatRecord(id1);
  assert(del2 === false, "Case 2: deleteChatRecord returned false on already deleted row");

  // Case 3: deleteChatRecord on a never-seen UUID -> false, no throw
  const idNeverSeen = `never-seen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const del3 = deleteChatRecord(idNeverSeen);
  assert(del3 === false, "Case 3: deleteChatRecord returned false on never-seen UUID");

  // Case 4: Create a row, corrupt messages_json via raw SQL, deleteChatRecord still returns true (no CorruptChatError)
  const id4 = `test-corrupt-${Date.now()}`;
  createChatRecord({
    id: id4,
    title: "Test Corrupt",
    messages: [
      {
        id: "msg-4",
        role: "user",
        parts: [{ type: "text", text: "Hello corrupt test" }],
      },
    ],
  });
  const db = getChatsDb();
  db.prepare("UPDATE chats SET messages_json = ? WHERE id = ?").run(
    "not-json-corrupt-data",
    id4,
  );
  let del4 = false;
  try {
    del4 = deleteChatRecord(id4);
    assert(del4 === true, "Case 4: deleteChatRecord succeeded on corrupt messages_json row");
  } catch (err) {
    assert(false, `Case 4: deleteChatRecord threw on corrupt row: ${err}`);
  }
  assert(getChat(id4) === null, "Case 4: corrupt row is deleted");

  // Case 5: After delete, listChats does not include that id
  const id5 = `test-list-${Date.now()}`;
  createChatRecord({
    id: id5,
    title: "Test List",
    messages: [
      {
        id: "msg-5",
        role: "user",
        parts: [{ type: "text", text: "Hello list test" }],
      },
    ],
  });
  const listBefore = listChats({ limit: 30 });
  assert(
    listBefore.chats.some((c) => c.id === id5),
    "Case 5: Chat 5 present in list before delete",
  );
  deleteChatRecord(id5);
  const listAfter = listChats({ limit: 30 });
  assert(
    !listAfter.chats.some((c) => c.id === id5),
    "Case 5: Chat 5 absent from list after delete",
  );

  // Case 6: Negative static assertion: ensure SQL in src/lib/chats.ts has WHERE clause and no DELETE without WHERE
  const chatsSource = readFileSync(
    path.join(root, "src/lib/chats.ts"),
    "utf8",
  );
  const deleteStatements = chatsSource.match(/DELETE\s+FROM\s+chats[^\n;]*/gi) ?? [];
  assert(
    deleteStatements.length > 0,
    "Case 6: Found DELETE statement in src/lib/chats.ts",
  );
  for (const stmt of deleteStatements) {
    assert(
      /WHERE\s+id\s*=\s*\?/i.test(stmt),
      `Case 6: DELETE statement has parameterized WHERE id = ?: "${stmt.trim()}"`,
    );
  }

  // Handler contract H1–H8 (in-process GET/POST/DELETE, not a live Next server).
  const { GET, POST, DELETE } = await import(
    pathToFileURL(path.join(root, "src/app/api/chats/route.ts")).href
  );

  // H1: DELETE /api/chats (no id) -> 400
  const h1Res = await DELETE(new Request("http://localhost:3000/api/chats", { method: "DELETE" }));
  assert(h1Res.status === 400, `H1: DELETE without id returned 400 (got ${h1Res.status})`);
  const h1Body = await h1Res.json();
  assert(h1Body.ok === false && h1Body.error === "id is required", "H1: error body matches");

  // H2: DELETE /api/chats?id= -> 400
  const h2Res = await DELETE(new Request("http://localhost:3000/api/chats?id=", { method: "DELETE" }));
  assert(h2Res.status === 400, `H2: DELETE with empty id returned 400 (got ${h2Res.status})`);

  // H3: DELETE /api/chats?id=does-not-exist -> 204, empty body
  const h3Res = await DELETE(new Request("http://localhost:3000/api/chats?id=does-not-exist", { method: "DELETE" }));
  assert(h3Res.status === 204, `H3: DELETE does-not-exist returned 204 (got ${h3Res.status})`);
  const h3Text = await h3Res.text();
  assert(h3Text === "", "H3: 204 response has empty body");

  // H4: POST /api/chats with { chatId, messages } then DELETE ?id= that id -> 204
  const h4Id = `http-chat-${Date.now()}`;
  const h4PostRes = await POST(new Request("http://localhost:3000/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId: h4Id,
      messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "HTTP chat" }] }],
    }),
  }));
  assert(h4PostRes.status === 200, `H4: POST returned 200 (got ${h4PostRes.status})`);
  const h4DelRes = await DELETE(new Request(`http://localhost:3000/api/chats?id=${h4Id}`, { method: "DELETE" }));
  assert(h4DelRes.status === 204, `H4: DELETE returned 204 (got ${h4DelRes.status})`);

  // H5: GET /api/chats?id= same id after H4 -> 404
  const h5Res = await GET(new Request(`http://localhost:3000/api/chats?id=${h4Id}`));
  assert(h5Res.status === 404, `H5: GET deleted chat returned 404 (got ${h5Res.status})`);

  // H6: GET /api/chats list does not contain that id -> 200 list
  const h6Res = await GET(new Request("http://localhost:3000/api/chats"));
  assert(h6Res.status === 200, `H6: GET list returned 200 (got ${h6Res.status})`);
  const h6Body = await h6Res.json();
  assert(!h6Body.chats.some((c) => c.id === h4Id), "H6: Deleted chat not in list");

  // H7: Second DELETE ?id= same id -> 204 again
  const h7Res = await DELETE(new Request(`http://localhost:3000/api/chats?id=${h4Id}`, { method: "DELETE" }));
  assert(h7Res.status === 204, `H7: Second DELETE returned 204 (got ${h7Res.status})`);

  // H8: GET /api/chats?id= unknown (never posted) -> still 404
  const h8Res = await GET(new Request("http://localhost:3000/api/chats?id=never-posted-uuid"));
  assert(h8Res.status === 404, `H8: GET unknown chat returned 404 (got ${h8Res.status})`);
} catch (err) {
  console.error("Unhandled error during verification:", err);
  failed += 1;
} finally {
  cleanupTempDb();
}

if (failed > 0) {
  console.error(`\nverify-chat-delete failed (${failed})`);
  process.exit(1);
}
console.log("\nverify-chat-delete passed");
process.exit(0);
