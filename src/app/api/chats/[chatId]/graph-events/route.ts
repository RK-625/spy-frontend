import type { ModelMessage } from "ai";
import { getChatWithMessages } from "@/lib/chats/sqlite";
import { subscribeToGraphUpdates } from "@/lib/chats/graph-events";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId } = await params;

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

      const writeSnapshot = (messages: ModelMessage[]) => {
        write("graph-history-updated", {
          type: "graph-history-updated",
          chatId,
          messages,
        });
      };

      // Subscribe before reading: a publish landing between the read and
      // the snapshot write is buffered and replayed after, never dropped
      // or overwritten by the older snapshot.
      let snapshotSent = false;
      let pending: ModelMessage[] | null = null;
      unsubscribe = subscribeToGraphUpdates(chatId, (messages) => {
        if (!snapshotSent) {
          pending = messages;
          return;
        }
        writeSnapshot(messages);
      });

      // No row yet (client mints the id before first persist): stream an
      // empty snapshot instead of 404ing, or EventSource retries forever
      // with no subscriber registered for later publishes.
      const chat = getChatWithMessages(chatId);
      writeSnapshot(chat?.graph_messages ?? []);
      snapshotSent = true;
      if (pending) {
        writeSnapshot(pending);
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
