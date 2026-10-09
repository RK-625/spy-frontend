import { generateText } from "ai";
import { buildChatTitleInstructions } from "@/prompts/chat-title-instructions";

type GenerateTextOptions = Parameters<typeof generateText>[0];

/** Room for reasoning models at their lowest effort; the title itself is a few words. */
const TITLE_MAX_OUTPUT_TOKENS = 1024;
const TITLE_TIMEOUT_MS = 20_000;

/**
 * One-shot title for a new chat. No tools, no history.
 * Returns the cleaned title, or "" when the model gave nothing usable.
 */
export async function runTitleAgent({
  model,
  providerOptions,
  firstMessage,
}: {
  model: GenerateTextOptions["model"];
  providerOptions: GenerateTextOptions["providerOptions"];
  firstMessage: string;
}): Promise<string> {
  const { text } = await generateText({
    model,
    providerOptions,
    instructions: buildChatTitleInstructions(),
    prompt: firstMessage,
    maxOutputTokens: TITLE_MAX_OUTPUT_TOKENS,
    timeout: TITLE_TIMEOUT_MS,
  });
  // Models still wrap titles in quotes or end them with a period now and then.
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!]+$/, "")
    .trim();
}
