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

  const stream = new ReadableStream({
    start(controller) {
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

      request.signal.addEventListener(
        "abort",
        () => {
          closed = true;
          unsubscribe?.();
          unsubscribe = undefined;
          if (heartbeat) clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            // The stream may already be closed by the runtime.
          }
        },
        { once: true },
      );
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      unsubscribe = undefined;
      if (heartbeat) clearInterval(heartbeat);
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
