/**
 * Shared module bake worker — one Worker for all Pixi renderer instances.
 *
 * Avoids construct/teardown thrash when canvases remount. Fail-open: if
 * Worker is unavailable or errors, acquire returns null and callers use
 * sync sampleGraphEdgeDots (same as per-instance path).
 *
 * Demux: each client registers a handler + clientId; responses route by
 * clientId (fallback: broadcast to all if missing — single-client case).
 *
 * postBake transfers payload typed-array buffers (see bakePayloadTransferList).
 */

import {
  bakePayloadTransferList,
} from "@/lib/graph/bake-sample";
import type {
  BakeWorkerRequest,
  BakeWorkerResponse,
} from "@/lib/graph/bake-worker";

export type BakeWorkerClientHandler = (msg: BakeWorkerResponse) => void;

type ClientEntry = {
  id: number;
  onMessage: BakeWorkerClientHandler;
  onError: (err: ErrorEvent) => void;
};

let sharedWorker: Worker | null | undefined;
let nextClientId = 1;
const clients = new Map<number, ClientEntry>();
let failLogged = false;

function logFailOnce(err: unknown): void {
  if (failLogged) return;
  failLogged = true;
  console.warn(
    "[graph] bake worker unavailable, using sync bake forever",
    err
  );
}

function ensureWorker(): Worker | null {
  if (sharedWorker !== undefined) {
    return sharedWorker;
  }
  if (typeof Worker === "undefined") {
    sharedWorker = null;
    return null;
  }
  try {
    const w = new Worker(new URL("./bake-worker.ts", import.meta.url), {
      type: "module",
    });
    w.addEventListener("message", (ev: MessageEvent<BakeWorkerResponse>) => {
      const msg = ev.data;
      if (!msg || msg.type !== "bake-result") return;
      const cid = msg.clientId;
      if (typeof cid === "number") {
        const client = clients.get(cid);
        client?.onMessage(msg);
        return;
      }
      // Legacy / missing clientId — deliver to sole client if exactly one.
      if (clients.size === 1) {
        const only = clients.values().next().value;
        only?.onMessage(msg);
      }
    });
    w.addEventListener("error", (err: ErrorEvent) => {
      logFailOnce(err.message);
      for (const c of clients.values()) {
        c.onError(err);
      }
      // Kill shared worker so subsequent acquires fail-open to sync.
      try {
        w.terminate();
      } catch {
        // ignore
      }
      sharedWorker = null;
    });
    sharedWorker = w;
    return w;
  } catch (err) {
    sharedWorker = null;
    logFailOnce(err);
    return null;
  }
}

export type BakeWorkerLease = {
  clientId: number;
  worker: Worker;
  postBake: (req: BakeWorkerRequest) => void;
  release: () => void;
};

/**
 * Acquire a lease on the shared bake worker.
 * Returns null when Worker cannot be constructed (sync bake forever).
 */
export function acquireBakeWorker(
  onMessage: BakeWorkerClientHandler,
  onError: (err: ErrorEvent) => void
): BakeWorkerLease | null {
  const w = ensureWorker();
  if (!w) return null;

  const id = nextClientId++;
  clients.set(id, { id, onMessage, onError });

  return {
    clientId: id,
    worker: w,
    postBake(req: BakeWorkerRequest): void {
      // Always stamp clientId for demux; transfer payload typed arrays.
      const stamped: BakeWorkerRequest = {
        ...req,
        clientId: id,
      };
      const transfer = bakePayloadTransferList(stamped.payload);
      w.postMessage(stamped, transfer);
    },
    release(): void {
      clients.delete(id);
      // Keep shared worker alive across remounts (no terminate on last release).
    },
  };
}
