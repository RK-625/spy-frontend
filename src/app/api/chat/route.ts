import { after } from "next/server";
import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { runAgent } from "@/ai/agent";
import { FALLBACK_GRAPH_CHAT_ID } from "@/ai/agent/graph/job-queue";

/** Agent tools touch FalkorDB native driver — must not run on Edge. */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Omit<
      Parameters<typeof runAgent>[0],
      "abortSignal" | "chatId"
    > & { id?: unknown };
    const rawId = payload.id;
    const chatId =
      typeof rawId === "string" && rawId.trim().length > 0
        ? rawId.trim()
        : FALLBACK_GRAPH_CHAT_ID;
    const { streamResult, runBackgroundTasks } = await runAgent({
      ...payload,
      chatId,
      abortSignal: req.signal,
    });

    after(async () => {
      await runBackgroundTasks();
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: streamResult.stream }),
    });
  } catch (error: unknown) {
    console.error("API ROUTE ERROR DETECTED:", error);
    throw error;
  }
}
