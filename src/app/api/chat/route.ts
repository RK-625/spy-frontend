import { after, NextResponse } from "next/server";
import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { runAgent } from "@/ai/agent";

/** Agent tools touch FalkorDB native driver — must not run on Edge. */
export const runtime = "nodejs";
export const maxDuration = 100;

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Omit<
      Parameters<typeof runAgent>[0],
      "abortSignal" | "chatId"
    > & { chatId?: unknown };

    if (
      typeof payload.chatId !== "string" ||
      payload.chatId.trim().length === 0
    ) {
      return NextResponse.json(
        { ok: false, error: "chatId is required" },
        { status: 400 },
      );
    }

    const chatId = payload.chatId;
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
