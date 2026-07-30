/**
 * Dedicated Web Worker entry for off-main-thread DotStream edge-dot sampling.
 *
 * Runs inside the browser Worker context (self.onmessage).
 * Communicates with main thread via structured clone / ArrayBuffer transferables.
 *
 * Architecture & performance invariants:
 * - Worker owns NO Pixi objects, DOM, window, canvas, or WebGL context.
 * - Pure Float32Array / Uint32Array / Uint8Array math only.
 * - Single-pass DotStream sampling matching `sampleGraphEdgeDots`.
 * - Emits transferable Float32Array (dots) + Uint32Array (edgeRangesPacked).
 * - Seq filtering: worker processes queued tasks; main drops stale seq on return.
 * - Multi-client lease pooling: shared worker multiplexes requests using clientId.
 * - Mode: "full" (all payload edges) or "partial" (subset dirty merge).
 *
 * Cooperative cancellation (latest-only):
 * - Keeps `pendingByClient` map (clientId → newest request).
 * - Skips superseded requests before sampling starts.
 * - Checks `pendingByClient` after each sampled edge; aborts early if newer seq.
 */

import {
  packEdgeRanges,
  sampleGraphEdgeDotsCooperative,
  type BakeSamplePayload,
} from "./bake-sample";

export type BakeWorkerMode = "full" | "partial";

export type BakeWorkerRequest = {
  type: "bake";
  seq: number;
  clientId: string;
  mode?: BakeWorkerMode;
  payload: BakeSamplePayload;
};

export type BakeWorkerResponse = {
  type: "bake-result";
  seq: number;
  clientId: string;
  mode: BakeWorkerMode;
  dots: Float32Array;
  dotCount: number;
  /** Packed Uint32Array: [edgeIdStrIndex, startDot, dotCount] * N + string table. */
  edgeRangesPacked: Uint32Array;
};

// Check if running inside a Web Worker context
const isWorkerContext =
  typeof self !== "undefined" &&
  typeof (self as unknown as Worker).postMessage === "function" &&
  typeof window === "undefined";

if (isWorkerContext) {
  const ctx = self as unknown as DedicatedWorkerGlobalScope;

  /** Newest request waiting to be sampled per client. */
  const pendingByClient = new Map<string, BakeWorkerRequest>();
  /** Seq currently being sampled per client (0 if idle). */
  const activeSeqByClient = new Map<string, number>();

  let isLoopRunning = false;

  function drainPendingQueue(): void {
    if (isLoopRunning) return;
    isLoopRunning = true;

    try {
      while (pendingByClient.size > 0) {
        // Pick any client with pending work
        const clientId = pendingByClient.keys().next().value;
        if (!clientId) break;

        const req = pendingByClient.get(clientId);
        pendingByClient.delete(clientId);
        if (!req) continue;

        const mode = req.mode ?? "full";
        activeSeqByClient.set(req.clientId, req.seq);

        /** Abort mid-sample check: true when caller posted a newer seq for this client. */
        const shouldAbort = (): boolean => {
          const pending = pendingByClient.get(req.clientId);
          return pending !== undefined && pending.seq > req.seq;
        };

        const result = sampleGraphEdgeDotsCooperative(req.payload, shouldAbort);

        activeSeqByClient.delete(req.clientId);

        // If aborted, drop result — main will process the newer request next.
        if (result.aborted) {
          continue;
        }

        const packedRanges = packEdgeRanges(result.edgeRanges);

        const response: BakeWorkerResponse = {
          type: "bake-result",
          seq: req.seq,
          clientId: req.clientId,
          mode,
          dots: result.dots,
          dotCount: result.dotCount,
          edgeRangesPacked: packedRanges,
        };

        // Transfer buffers back to main thread (zero-copy)
        ctx.postMessage(response, [result.dots.buffer, packedRanges.buffer]);
      }
    } finally {
      isLoopRunning = false;
    }
  }

  (
    self as unknown as {
      onmessage: ((event: MessageEvent<BakeWorkerRequest>) => void) | null;
    }
  ).onmessage = (event: MessageEvent<BakeWorkerRequest>) => {
    const data = event.data;
    if (!data || data.type !== "bake") return;

    const existingPending = pendingByClient.get(data.clientId);
    if (!existingPending || data.seq > existingPending.seq) {
      pendingByClient.set(data.clientId, data);
    }

    drainPendingQueue();
  };
}
