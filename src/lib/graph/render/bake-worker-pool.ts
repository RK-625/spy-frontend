/**
 * Shared singleton Worker lease pool for graph DotStream bake sampling.
 *
 * Multiplexes requests from multiple clients onto a single Web Worker.
 * Handles worker instantiation, client registration, and error recovery.
 *
 * Safe for Next.js App Router (handles SSR where `window` / `Worker` are undefined).
 */

import {
  bakePayloadTransferList,
  type BakeSamplePayload,
} from "./bake-sample";
import type { BakeWorkerRequest, BakeWorkerResponse } from "./bake-worker";

export type BakeWorkerResultHandler = (response: BakeWorkerResponse) => void;
export type BakeWorkerErrorHandler = (error: ErrorEvent) => void;

export type BakeWorkerLease = {
  clientId: string;
  postBake: (request: BakeWorkerRequest) => void;
  release: () => void;
};

let sharedWorker: Worker | null = null;
let clientCounter = 0;
const activeClients = new Map<
  string,
  {
    onResult: BakeWorkerResultHandler;
    onError?: BakeWorkerErrorHandler;
  }
>();

/**
 * Creates the module Web Worker instance using modern bundler syntax.
 * Returns null if Workers are unavailable in the current environment (e.g. SSR).
 */
function createWorkerInstance(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  try {
    const worker = new Worker(
      new URL("./bake-worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent<BakeWorkerResponse>) => {
      const data = event.data;
      if (!data || data.type !== "bake-result") return;

      const client = activeClients.get(data.clientId);
      if (client) {
        client.onResult(data);
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      console.error("[graph] bake worker pool error:", event);
      // Dispatch error to all registered clients
      for (const client of activeClients.values()) {
        if (client.onError) {
          client.onError(event);
        }
      }
      // Terminate and reset shared worker so subsequent requests retry creation
      terminateWorker();
    };

    return worker;
  } catch (err) {
    console.warn("[graph] failed to create bake worker instance:", err);
    return null;
  }
}

function terminateWorker(): void {
  if (sharedWorker) {
    try {
      sharedWorker.terminate();
    } catch {
      // ignore
    }
    sharedWorker = null;
  }
}

/**
 * Acquire a lease on the shared bake worker.
 * Returns null if worker creation fails (caller should fall back to sync bake).
 */
export function acquireBakeWorker(
  onResult: BakeWorkerResultHandler,
  onError?: BakeWorkerErrorHandler
): BakeWorkerLease | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (!sharedWorker) {
    sharedWorker = createWorkerInstance();
    if (!sharedWorker) {
      return null;
    }
  }

  clientCounter += 1;
  const clientId = `client_${clientCounter}_${Date.now()}`;

  activeClients.set(clientId, { onResult, onError });

  const lease: BakeWorkerLease = {
    clientId,

    postBake(req: BakeWorkerRequest): void {
      if (!sharedWorker) {
        console.warn("[graph] postBake called on terminated worker");
        return;
      }

      const transfers = bakePayloadTransferList(req.payload);
      sharedWorker.postMessage(req, transfers);
    },

    release(): void {
      activeClients.delete(clientId);
      if (activeClients.size === 0) {
        terminateWorker();
      }
    },
  };

  return lease;
}
