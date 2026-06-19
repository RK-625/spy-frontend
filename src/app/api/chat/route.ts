import { runAgent } from "@/ai/agent";

export const maxDuration = 30;

export async function POST(req:Request) {
  const {messages} = await req.json();
  const streamResult = await runAgent(messages);
  return streamResult.toTextStreamResponse();
}