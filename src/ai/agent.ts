import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  stepCountIs,
} from "ai";
import { toolSet } from "./toolset";
import { modelConfig } from "./modelstore";
import { systemPrompt } from "@/prompts/system-prompt";

export async function runAgent({
  messages,
  model,
  useWebSearch,
  mode,
}: {
  messages: UIMessage[];
  model: string;
  useWebSearch: boolean;
  mode?: string;
}) {
  const modelMessages = await convertToModelMessages(messages);
  const { webSearch, ...toolsWithoutSearch } = toolSet;
  const { model: resolvedModel, providerOptions: resolvedProviderOptions } =
    modelConfig({ model, mode });
  const result = streamText({
    model: resolvedModel,
    system: systemPrompt,
    messages: modelMessages,
    tools: useWebSearch ? toolSet : toolsWithoutSearch,
    stopWhen: useWebSearch ? stepCountIs(25) : stepCountIs(5),
    providerOptions: resolvedProviderOptions,
  });
  return result;
}
