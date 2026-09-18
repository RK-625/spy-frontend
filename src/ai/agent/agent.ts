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
}): Promise<{
  streamResult: ReturnType<typeof runChatAgent>;
  runBackgroundTasks: () => Promise<void>;
}> {
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
    ? await connectExcalidrawMcp().catch((error: unknown) => {
      console.error("[excalidraw-mcp] connect failed:", error);
      return { tools: {}, close: () => Promise.resolve() };
    })
    : {};

  const tools: ToolSet = { ...baseTools, ...mcpTools };

  const { model: resolvedModel, providerOptions: resolvedProviderOptions } =
    modelConfig({ model, mode });
  // Web or Excalidraw MCP tool loops need a higher step budget.
  const streamResult = runChatAgent({
    model: resolvedModel,
    instructions: buildChatInstructions(),
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(useWebSearch || useExcalidraw ? 25 : 8),
    providerOptions: resolvedProviderOptions,
  });

  const runBackgroundTasks = async (): Promise<void> => {
    let responseMessages:
      | Awaited<(typeof streamResult)["responseMessages"]>
      | undefined;
    try {
      responseMessages = await streamResult.responseMessages;
    } catch (error: unknown) {
      console.error("[chat-agent] response messages failed:", error);
    } finally {
      if (closeExcalidraw) {
        await closeExcalidraw().catch((error: unknown) => {
          console.error("[excalidraw-mcp] close failed:", error);
        });
      }
    }

    if (responseMessages !== undefined && responseMessages.length > 0) {
      try {
        await runGraphAgent({
          model: resolvedModel,
          providerOptions: resolvedProviderOptions,
          messages: [...modelMessages, ...responseMessages],
        });
      } catch (error: unknown) {
        console.error("[graph-agent] failed:", error);
      }
    }
  };

  return {
    streamResult,
    runBackgroundTasks,
  };
}
