import { after } from "next/server";
import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { runAgent } from "@/ai/agent";

/** Agent tools touch FalkorDB native driver — must not run on Edge. */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Parameters<typeof runAgent>[0];
    const { streamResult, runBackgroundTasks } = await runAgent(payload);

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
