import { createOpenAI } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  type LanguageModel,
  stepCountIs,
} from "ai";
import { toolSet } from "./toolset";

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY, // Set this in your environment
});

export async function runAgent({
  messages,
  model,
  useWebSearch,
}: {
  messages: UIMessage[];
  model: string;
  useWebSearch: boolean;
}) {
  const currmdeol = deepseek.chat("deepseek-v4-flash");
  const modelMessages = await convertToModelMessages(messages);
  const { webSearch, ...toolsWithoutSearch } = toolSet;
  const result = streamText({
    model: currmdeol as unknown as LanguageModel,
    system: "You are a helpful AI assistant. Be brief and playful. ",
    messages: modelMessages,
    tools: useWebSearch ? toolSet : toolsWithoutSearch,
    stopWhen: useWebSearch ? stepCountIs(5) : undefined,
  });
  return result;
}
