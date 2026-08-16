import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  stepCountIs,
} from "ai";
import { createToolSet } from "../tools/toolset";
import { modelConfig } from "../models/modelstore";
import { slimJson } from "../slim-json";
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
  // Client-side tools (e.g. askUserQuestion) may be input-available with no
  // tool result; the user answers as a normal chat message. Drop incomplete
  // tool calls so they do not poison model history.
  const modelMessages = await convertToModelMessages(messages, {
    ignoreIncompleteToolCalls: true,
  });
  // Model-scoped tools so upsertMemory can LLM-generate retrieval questions.
  const toolSet = createToolSet({ model });
  // Only webSearch is optional; memory weave + askUserQuestion stay always on.
  const { webSearch, ...toolsWithoutSearch } = toolSet;
  const tools = useWebSearch ? toolSet : toolsWithoutSearch;
  const { model: resolvedModel, providerOptions: resolvedProviderOptions } =
    modelConfig({ model, mode });
  const result = streamText({
    model: resolvedModel,
    system: systemPrompt,
    messages: modelMessages,
    tools,
    // Non-web: room for upsertMemory + manageLinks (+ ask) without truncating.
    stopWhen: useWebSearch ? stepCountIs(25) : stepCountIs(8),
    providerOptions: resolvedProviderOptions,
    experimental_onToolCallFinish(event) {
      const { toolCall, success, durationMs, stepNumber } = event;
      const payload = {
        step: stepNumber,
        ms: durationMs,
        input: toolCall.input,
        ...(success
          ? { output: slimJson(event.output) }
          : { error: slimJson(event.error) }),
      };
      if (success) {
        console.log("[tool]", toolCall.toolName, payload);
      } else {
        console.error("[tool]", toolCall.toolName, payload);
      }
    },
  });
  return result;
}
