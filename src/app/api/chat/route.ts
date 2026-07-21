import { runAgent } from "@/ai/agent";

export const maxDuration = 30;

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
