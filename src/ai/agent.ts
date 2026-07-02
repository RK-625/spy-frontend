import { createOpenAI } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  type LanguageModel,
} from "ai";
const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY, // Set this in your environment
});
export async function runAgent(messages: UIMessage[]) {
  const currmdeol = deepseek.chat("deepseek-v4-flash");
  const modelMessages = await convertToModelMessages(messages);
  const result = streamText({
    model: currmdeol as unknown as LanguageModel,
    system: "You are a helpful AI assistant. Be brief and playful. ",
    messages: modelMessages,
  });
  return result;
}
