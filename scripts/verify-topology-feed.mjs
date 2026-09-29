/** In-memory transport checks; never opens Falkor or the real user stores. */
import assert from "node:assert/strict";
import { connectTopologyFeed } from "../src/lib/graph/client/topology-feed.ts";

class TestSource extends EventTarget {
  closed = false;
  open() { this.dispatchEvent(new Event("open")); }
  update(revision) {
    this.dispatchEvent(new MessageEvent("graph-topology-updated", {
      data: JSON.stringify({ type: "graph-topology-updated", revision }),
    }));
  }
  close() { this.closed = true; }
}

const settle = () => new Promise((resolve) => setImmediate(resolve));
const source = new TestSource();
let refreshCount = 0;
const releases = [];
const disconnect = connectTopologyFeed(() => {
  refreshCount += 1;
  return new Promise((resolve) => releases.push(resolve));
}, () => source);

source.open();
source.update(5);
await settle();
assert.equal(refreshCount, 1, "connection baseline refreshes the snapshot");
source.update(5);
source.update(4);
releases.shift()();
await settle();
assert.equal(refreshCount, 1, "duplicate and older revisions do not refresh");

source.update(6);
source.update(7);
source.update(8);
await settle();
assert.equal(refreshCount, 2, "a synchronous burst shares one refresh");
source.update(9);
source.update(10);
await settle();
assert.equal(refreshCount, 2, "writes during refresh wait instead of overlapping");
releases.shift()();
await settle();
assert.equal(refreshCount, 3, "writes during refresh cause a trailing fetch");
releases.shift()();
await settle();

source.open();
source.update(10);
await settle();
assert.equal(refreshCount, 4, "reconnect baseline refreshes even at the same revision");
releases.shift()();
await settle();
source.open();
source.update(0);
await settle();
assert.equal(refreshCount, 5, "server revision reset does not suppress refreshes");
source.update(1);
disconnect();
releases.shift()();
await settle();
source.open();
source.update(2);
await settle();
assert.equal(refreshCount, 5, "cleanup discards queued work and removes listeners");
assert.equal(source.closed, true, "cleanup closes the connection");

const cancelledSource = new TestSource();
let cancelledRefreshes = 0;
const cancel = connectTopologyFeed(async () => { cancelledRefreshes += 1; }, () => cancelledSource);
cancelledSource.update(0);
cancel();
await settle();
assert.equal(cancelledRefreshes, 0, "cleanup before the microtask prevents a fetch");

const resilientSource = new TestSource();
let attempts = 0;
const originalWarn = console.warn;
console.warn = () => {};
const stop = connectTopologyFeed(async () => {
  attempts += 1;
  if (attempts === 1) throw new Error("simulated fetch failure");
}, () => resilientSource);
try {
  resilientSource.dispatchEvent(new MessageEvent("graph-topology-updated", { data: "invalid" }));
  resilientSource.update(-1);
  resilientSource.update("1");
  await settle();
  assert.equal(attempts, 0, "malformed events do not trigger a refresh");
  resilientSource.update(0);
  await settle();
  resilientSource.update(1);
  await settle();
  assert.equal(attempts, 2, "a failed refresh does not block later events");
} finally {
  stop();
  console.warn = originalWarn;
}
console.log("verify-topology-feed passed: baseline, bursts, trailing fetch, reconnect, reset, failure, cleanup");
