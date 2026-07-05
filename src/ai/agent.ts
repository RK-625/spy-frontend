import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  stepCountIs,
} from "ai";
import { toolSet } from "./toolset";
import { modelStore } from "./modelstore";

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
  const result = streamText({
    model: modelStore(model),
    system: "You are a helpful AI assistant. Be brief and playful. ",
    messages: modelMessages,
    tools: useWebSearch ? toolSet : toolsWithoutSearch,
    stopWhen: useWebSearch ? stepCountIs(5) : undefined,
    reasoning: mode ? { effort: mode as "high" | "max" } : undefined,
  });
  return result;
}
