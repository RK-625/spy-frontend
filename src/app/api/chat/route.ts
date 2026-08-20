import { runAgent } from "@/ai/agent";

/** Agent tools touch FalkorDB native driver — must not run on Edge. */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const streamResult = await runAgent(payload);
    return streamResult.toUIMessageStreamResponse();
  } catch (error) {
    console.error("API ROUTE ERROR DETECTED:", error);
    throw error;
  }
}
