/**
 * Web Worker entry for DotStream edge sampling (appearance-neutral perf).
 *
 * Protocol (main ↔ worker):
 *   Request:  { type: "bake", seq, clientId?, mode?, payload }
 *             transfer: payload typed-array buffers (nodeXYR, edgeEndpoints, …)
 *   Response: { type: "bake-result", seq, clientId?, mode?, dots, dotCount,
 *               edgeRangesPacked }
 *             transfer: [dots.buffer, startDots.buffer, dotCounts.buffer]
 *
 * Main thread still owns: recomputeIncidence, applyRimLock, DotCircleBatch,
 * node Graphics, Pixi Mesh upload, camera transform, partial mesh merge.
 *
 * Sequence numbers: main ignores results where seq !== latest requested bake.
 * clientId demuxes a shared module worker across renderer instances.
 *
 * Latest-only / cancel:
 * - Per-client latest seq is updated on every message (even while a prior job
 *   is mid-sample via yield).
 * - Sample checks shouldAbort after each edge; stale jobs stop and do not post.
 * - Pending queue keeps only the newest bake per client so rapid overscan
 *   escape does not pile CPU on obsolete samples.
 */

import {
  sampleGraphEdgeDotsCooperative,
  type BakeEdgeRangesPacked,
  type BakeSamplePayload,
} from "@/lib/graph/bake-sample";

/** Full candidate rebake vs partial dirty-edge sample (merge on main). */
export type BakeWorkerMode = "full" | "partial";

export type BakeWorkerRequest = {
  type: "bake";
  seq: number;
  /** Shared-worker demux key (renderer instance). */
  clientId?: number;
  /** Default "full". Partial results are merged into resident edge chunks. */
  mode?: BakeWorkerMode;
  payload: BakeSamplePayload;
};

export type BakeWorkerResponse = {
  type: "bake-result";
  seq: number;
  clientId?: number;
  mode: BakeWorkerMode;
  /** Packed [cx, cy, r, color, alpha, t, u] * dotCount (exact length). */
  dots: Float32Array;
  dotCount: number;
  /** Packed parallel ranges (preferred over object edgeRanges for transfer). */
  edgeRangesPacked: BakeEdgeRangesPacked;
};

/** Worker global — typed loosely so DOM-only tsconfig accepts this module. */
type BakeWorkerScope = {
  onmessage: ((ev: MessageEvent<BakeWorkerRequest>) => void) | null;
  postMessage: (message: BakeWorkerResponse, transfer?: Transferable[]) => void;
  setTimeout: (fn: () => void, ms?: number) => number;
};

const ctx = self as unknown as BakeWorkerScope;

/** Highest seq seen per clientId (-1 key when clientId omitted). */
const latestSeqByClient = new Map<number, number>();
/** At most one pending request per client (latest wins). */
const pendingByClient = new Map<number, BakeWorkerRequest>();
let pumpRunning = false;

function clientKey(msg: BakeWorkerRequest): number {
  return typeof msg.clientId === "number" ? msg.clientId : -1;
}

function yieldTick(): Promise<void> {
  return new Promise((resolve) => {
    ctx.setTimeout(() => resolve(), 0);
  });
}

async function runBake(msg: BakeWorkerRequest): Promise<void> {
  const cid = clientKey(msg);
  const mode: BakeWorkerMode = msg.mode === "partial" ? "partial" : "full";

  // Already superseded before start.
  if (msg.seq < (latestSeqByClient.get(cid) ?? 0)) {
    return;
  }

  const result = await sampleGraphEdgeDotsCooperative(msg.payload, {
    shouldAbort: () => msg.seq < (latestSeqByClient.get(cid) ?? 0),
    yieldEvery: 16,
    yieldFn: yieldTick,
  });

  if (result.aborted) return;
  if (msg.seq < (latestSeqByClient.get(cid) ?? 0)) return;

  const packed = result.edgeRangesPacked;
  const response: BakeWorkerResponse = {
    type: "bake-result",
    seq: msg.seq,
    clientId: msg.clientId,
    mode,
    dots: result.dots,
    dotCount: result.dotCount,
    edgeRangesPacked: packed,
  };
  // Transfer ownership of dots + range numeric arrays (zero-copy to main).
  const transfer: Transferable[] = [];
  const pushBuf = (buf: ArrayBufferLike): void => {
    if (buf instanceof ArrayBuffer && buf.byteLength > 0) {
      transfer.push(buf);
    }
  };
  pushBuf(result.dots.buffer);
  pushBuf(packed.startDots.buffer);
  pushBuf(packed.dotCounts.buffer);
  ctx.postMessage(response, transfer);
}

async function pump(): Promise<void> {
  if (pumpRunning) return;
  pumpRunning = true;
  try {
    while (pendingByClient.size > 0) {
      // Take one pending job (any client); re-read map each iteration.
      const entry = pendingByClient.entries().next().value as
        | [number, BakeWorkerRequest]
        | undefined;
      if (!entry) break;
      const [cid, msg] = entry;
      pendingByClient.delete(cid);

      // Skip if a newer seq already replaced this client while we waited.
      if (msg.seq < (latestSeqByClient.get(cid) ?? 0)) {
        continue;
      }

      await runBake(msg);
      // Allow queued onmessage handlers to update latestSeq / pending.
      await yieldTick();
    }
  } finally {
    pumpRunning = false;
    // Jobs may have been enqueued during the final yield.
    if (pendingByClient.size > 0) {
      void pump();
    }
  }
}

ctx.onmessage = (ev: MessageEvent<BakeWorkerRequest>) => {
  const msg = ev.data;
  if (!msg || msg.type !== "bake") return;

  const cid = clientKey(msg);
  const prev = latestSeqByClient.get(cid) ?? 0;
  if (msg.seq >= prev) {
    latestSeqByClient.set(cid, msg.seq);
  }

  // Latest-only queue: replace any older pending for this client.
  const existing = pendingByClient.get(cid);
  if (!existing || msg.seq >= existing.seq) {
    pendingByClient.set(cid, msg);
  }

  void pump();
};
