/**
 * Focused checks for global topology updates and the graph events SSE route:
 * - publishTopologyUpdate advances getTopologyRevision.
 * - A subscriber receives the event with matching revision/type.
 * - Unsubscribe stops delivery.
 * - GET graph events streams text/event-stream, sends the current revision
 *   as the connect baseline, and delivers a live publish after connect.
 * Pure in-memory test: touches no Falkor/SQLite/real DBs.
 * Run: npx tsx scripts/verify-topology-events.mjs
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

const parseSseData = (block) => {
  const json = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");
  return JSON.parse(json);
};

const readSseEvents = (res) => {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const readEvent = async () => {
    for (;;) {
      const end = buf.indexOf("\n\n");
      if (end !== -1) {
        const out = buf.slice(0, end);
        buf = buf.slice(end + 2);
        if (out.trim() === "" || out.startsWith(":")) continue;
        return out;
      }
      const { value, done } = await reader.read();
      if (done) return null;
      buf += decoder.decode(value, { stream: true });
    }
  };
  return { reader, readEvent };
};

let liveReader;
try {
  const {
    getTopologyRevision,
    publishTopologyUpdate,
    subscribeToTopologyUpdates,
  } = await import(
    pathToFileURL(path.join(root, "src/lib/graph/topology-events.ts")).href
  );

  const { GET } = await import(
    pathToFileURL(path.join(root, "src/app/api/graph/events/route.ts")).href
  );

  // T1: publish advances the revision counter.
  const r0 = getTopologyRevision();
  publishTopologyUpdate();
  const r1 = getTopologyRevision();
  assert(r1 === r0 + 1, `T1: publish advances revision (${r0} -> ${r1})`);

  // T2: subscriber receives the event with matching revision/type.
  const received = [];
  const unsubscribe = subscribeToTopologyUpdates((event) => {
    received.push(event);
  });
  publishTopologyUpdate();
  const r2 = getTopologyRevision();
  assert(
    received.length === 1,
    `T2: subscriber received one event (got ${received.length})`,
  );
  assert(
    received[0]?.type === "graph-topology-updated" &&
      received[0]?.revision === r2 &&
      typeof received[0]?.updatedAt === "number",
    "T2: event carries matching revision/type/updatedAt",
  );

  // T3: unsubscribe stops delivery.
  unsubscribe();
  publishTopologyUpdate();
  assert(
    received.length === 1,
    `T3: no delivery after unsubscribe (got ${received.length})`,
  );

  // T4: route streams SSE.
  const baseline = getTopologyRevision();
  const res = await GET(
    new Request("http://verify.invalid/"),
    // Tolerated by single-arg handlers; guards a context-destructuring impl.
    { params: Promise.resolve({}) },
  );
  assert(res.status === 200, `T4: GET -> 200 (got ${res.status})`);
  assert(
    res.headers.get("content-type")?.includes("text/event-stream") ?? false,
    `T4: content-type is text/event-stream (got ${res.headers.get("content-type")})`,
  );

  // T5: first event is the connect baseline revision.
  const { reader, readEvent } = readSseEvents(res);
  liveReader = reader;
  const first = await readEvent();
  const firstJson = first === null ? null : parseSseData(first);
  assert(
    firstJson?.type === "graph-topology-updated" &&
      firstJson?.revision === baseline &&
      typeof firstJson?.updatedAt === "number",
    `T5: first event is baseline revision ${baseline}`,
  );

  // T6: a live publish after connect is delivered.
  publishTopologyUpdate();
  const second = await readEvent();
  const secondJson = second === null ? null : parseSseData(second);
  assert(
    secondJson?.type === "graph-topology-updated" &&
      secondJson?.revision === baseline + 1,
    "T6: live publish delivered after connect",
  );
} finally {
  // Release the SSE stream so the route's heartbeat interval is cleared.
  if (liveReader) {
    try {
      await liveReader.cancel();
    } catch {
      // Ignore cleanup error
    }
  }
}

if (failed > 0) {
  console.error(`verify-topology-events failed: ${failed} check(s)`);
  process.exitCode = 1;
} else {
  console.log("verify-topology-events passed");
}
