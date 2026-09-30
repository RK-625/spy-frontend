import {
  getTopologyRevision,
  subscribeToTopologyUpdates,
  type TopologyUpdatedEvent,
} from "@/lib/graph/topology-events";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  let abortListener: (() => void) | undefined;

  const cleanup = () => {
    if (closed) return false;
    closed = true;
    unsubscribe?.();
    unsubscribe = undefined;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    if (abortListener) request.signal.removeEventListener("abort", abortListener);
    abortListener = undefined;
    return true;
  };

  const stream = new ReadableStream({
    start(controller) {
      if (request.signal.aborted) {
        closed = true;
        controller.close();
        return;
      }
      const write = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      const writeTopologyUpdate = (event: TopologyUpdatedEvent) => {
        write("graph-topology-updated", event);
      };

      // Subscribe before reading: a publish landing between the read and
      // the baseline write is buffered and replayed after, never dropped
      // or overwritten by the older baseline.
      let baselineSent = false;
      let pending: TopologyUpdatedEvent | null = null;
      unsubscribe = subscribeToTopologyUpdates((event) => {
        if (!baselineSent) {
          pending = event;
          return;
        }
        writeTopologyUpdate(event);
      });

      writeTopologyUpdate({
        type: "graph-topology-updated",
        revision: getTopologyRevision(),
        updatedAt: Date.now(),
      });
      baselineSent = true;
      if (pending) {
        writeTopologyUpdate(pending);
        pending = null;
      }

      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 20_000);

      abortListener = () => {
        if (!cleanup()) return;
        try {
          controller.close();
        } catch {
          // The runtime may have already closed the response stream.
        }
      };
      request.signal.addEventListener("abort", abortListener, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
