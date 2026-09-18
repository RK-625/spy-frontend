import {
  convertToModelMessages,
  type UIMessage,
  isStepCount,
  type ToolSet,
} from "ai";
import { createChatToolSet } from "../tools/agent-toolsets";
import { connectExcalidrawMcp } from "../tools/excalidraw-mcp";
import { modelConfig } from "../models/modelstore";
import { buildChatInstructions } from "@/prompts/chat-instructions";
import { runChatAgent } from "./chat/agent";
import { runGraphAgent } from "./graph/agent";

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
  const toolSet = createChatToolSet();
  // webSearch and Excalidraw MCP are optional; retrieval + ask stay on.
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
  // Web or Excalidraw MCP tool loops need a higher step budget.
  return runChatAgent({
    model: resolvedModel,
    instructions: buildChatInstructions(),
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(useWebSearch || useExcalidraw ? 25 : 8),
    providerOptions: resolvedProviderOptions,
    onEnd: async (event) => {
      try {
        if (event.responseMessages.length > 0) {
          await runGraphAgent({
            model: resolvedModel,
            providerOptions: resolvedProviderOptions,
            messages: [...modelMessages, ...event.responseMessages],
          });
        }
      } catch (error) {
        console.error("[graph-agent] failed:", error);
      } finally {
        if (closeExcalidraw) {
          await closeExcalidraw();
        }
      }
    },
  });
}
