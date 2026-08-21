import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  isStepCount,
  type ToolSet,
} from "ai";
import { createToolSet } from "../tools/toolset";
import { connectExcalidrawMcp } from "../tools/excalidraw-mcp";
import { modelConfig } from "../models/modelstore";
import { slimJson } from "../slim-json";
import { buildSystemPrompt } from "@/prompts/system-prompt";

export async function runAgent({
  messages,
  model,
  useWebSearch,
  useExcalidraw,
  mode,
}: {
  messages: UIMessage[];
  model: string;
  useWebSearch: boolean;
  useExcalidraw?: boolean;
  mode?: string;
}) {
  // Client-side tools (e.g. askUserQuestion) may be input-available with no
  // tool result; the user answers as a normal chat message. Drop incomplete
  // tool calls so they do not poison model history.
  const modelMessages = await convertToModelMessages(messages, {
    ignoreIncompleteToolCalls: true,
  });
  // Product tools are model-agnostic; chat model stays on modelConfig only.
  const toolSet = createToolSet();
  // webSearch and Excalidraw MCP are optional; memory weave + ask stay on.
  const { webSearch, ...toolsWithoutSearch } = toolSet;
  const baseTools = useWebSearch ? toolSet : toolsWithoutSearch;

  const { tools: mcpTools, close: closeExcalidraw } = useExcalidraw
    ? await connectExcalidrawMcp().catch((error) => {
      console.error("[excalidraw-mcp] connect failed:", error);
      return { tools: {}, close: () => Promise.resolve() };
    })
    : {};

  const tools: ToolSet = { ...baseTools, ...mcpTools };

  const { model: resolvedModel, providerOptions: resolvedProviderOptions } =
    modelConfig({ model, mode });
  const result = streamText({
    model: resolvedModel,
    instructions: buildSystemPrompt({ useExcalidraw }),
    messages: modelMessages,
    tools,
    // Non-web: room for upsertMemory + manageLinks (+ ask) without truncating.
    // Web or Excalidraw MCP tool loops need a higher step budget.
    stopWhen: isStepCount(useWebSearch || useExcalidraw ? 25 : 8),
    providerOptions: resolvedProviderOptions,
    onEnd: async () => {
      if (closeExcalidraw) {
        await closeExcalidraw();
      }
    },
    onToolExecutionEnd(event) {
      const { toolCall, toolExecutionMs, toolOutput } = event;
      const payload = {
        ms: toolExecutionMs,
        input: toolCall.input,
        ...(toolOutput.type === "tool-result"
          ? { output: slimJson(toolOutput.output) }
          : { error: slimJson(toolOutput.error) }),
      };
      if (toolOutput.type === "tool-result") {
        console.log("[tool]", toolCall.toolName, payload);
      } else {
        console.error("[tool]", toolCall.toolName, payload);
      }
    },
  });
  return result;
}
