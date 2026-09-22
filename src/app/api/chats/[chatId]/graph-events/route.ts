import { getChatWithMessages } from "@/lib/chats/sqlite";
import { subscribeToGraphUpdates } from "@/lib/chats/graph-events";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId } = await params;
  const chat = getChatWithMessages(chatId);

  if (!chat) {
    return new Response("Chat not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

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

      const unsubscribe = subscribeToGraphUpdates(chatId, (messages) => {
        write("graph-history-updated", {
          type: "graph-history-updated",
          messages,
        });
      });

      write("graph-history-updated", {
        type: "graph-history-updated",
        messages: chat.graph_messages,
      });

      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 20_000);

      request.signal.addEventListener(
        "abort",
        () => {
          closed = true;
          unsubscribe();
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
