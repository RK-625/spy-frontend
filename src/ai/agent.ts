import { openai } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

export async function runAgent(messages: ModelMessage[]) {
  const currmdeol = openai("gpt-4o");
  const result = streamText({
    model: currmdeol,
    system: "You are a helpful AI assistant, Be breif and playful ",
    messages,
  });
  return result;
}

