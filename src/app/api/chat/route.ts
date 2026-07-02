import { runAgent } from "@/ai/agent";
import { UIMessage } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    const streamResult = await runAgent(messages);
    return streamResult.toUIMessageStreamResponse();
  } catch (error) {
    console.error("API ROUTE ERROR DETECTED:", error);
    throw error;
  }
}
