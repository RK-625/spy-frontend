import {
  convertToModelMessages,
  type ModelMessage,
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
import { enqueueGraphJob } from "./graph/job-queue";
import { getChatWithMessages, replaceGraphMessages } from "@/lib/chats/sqlite";
import { publishGraphUpdate } from "@/lib/chats/graph-events";

function isAbortRejection(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "ResponseAborted")
  );
}

function wasChatStreamAborted({
  abortSignal,
  finishReason,
  rejection,
}: {
  abortSignal: AbortSignal | undefined;
  finishReason: string | undefined;
  rejection: unknown;
}): boolean {
  return (
    abortSignal?.aborted === true ||
    finishReason === "abort" ||
    isAbortRejection(rejection)
  );
}

export async function runAgent({
  messages,
  model,
  useWebSearch,
  useExcalidraw,
  mode,
  abortSignal,
  chatId,
}: {
  messages: UIMessage[];
  model: string;
  useWebSearch: boolean;
  useExcalidraw?: boolean;
  mode: string;
  abortSignal: AbortSignal;
  chatId: string;
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
    abortSignal,
  });

  const runBackgroundTasks = async (): Promise<void> => {
    let responseMessages:
      | Awaited<(typeof streamResult)["responseMessages"]>
      | undefined;
    let finalStep:
      | Awaited<(typeof streamResult)["finalStep"]>
      | undefined;
    let streamRejection: unknown;
    try {
      [responseMessages, finalStep] = await Promise.all([
        streamResult.responseMessages,
        streamResult.finalStep,
      ]);
    } catch (error: unknown) {
      streamRejection = error;
      if (
        !wasChatStreamAborted({
          abortSignal,
          finishReason: undefined,
          rejection: error,
        })
      ) {
        console.error("[chat-agent] response messages failed:", error);
      }
    } finally {
      if (closeExcalidraw) {
        await closeExcalidraw().catch((error: unknown) => {
          console.error("[excalidraw-mcp] close failed:", error);
        });
      }
    }

    const latestUserMessage = messages.at(-1);

    if (!latestUserMessage) {
      return;
    }

    // Graph history is ModelMessage[]; only the fresh user turn needs
    // UIMessage -> ModelMessage conversion. Chat response messages are
    // already ResponseMessage (a ModelMessage subtype).
    const latestAsModel = await convertToModelMessages(
      [latestUserMessage],
      { ignoreIncompleteToolCalls: true },
    );

    const chatAborted = wasChatStreamAborted({
      abortSignal,
      finishReason: finalStep?.finishReason,
      rejection: streamRejection,
    });

    // Check if the final step of this response stopped to ask the user a question.
    // Client-side tools wait for the user's answer; do not trigger the graph maintainer.
    const isWaitingOnUser =
      finalStep?.toolCalls.some(
        (call) => call.toolName === "askUserQuestion",
      ) === true;

    // Stream wait stays per-request; only Falkor writes serialize per chat.
    await enqueueGraphJob(chatId, async () => {
      try {
        const chat = getChatWithMessages(chatId);

        if (!chat) {
          console.log("[graph-agent] skipped: chat deleted");
          return;
        }

        // The user turn always lands in graph history, even when this turn
        // is skipped below (abort, askUserQuestion, empty response). Skipped
        // turns must not leave gaps in later graph runs.
        const baseHistory: ModelMessage[] = [
          ...chat.graph_messages,
          ...latestAsModel,
        ];
        replaceGraphMessages(chatId, baseHistory);
        publishGraphUpdate(chatId, baseHistory);

        // Stop / disconnect: record the user turn, but do not teach the
        // graph from a cancelled turn.
        if (chatAborted) {
          console.log("[graph-agent] skipped: chat aborted");
          return;
        }

        if (isWaitingOnUser) {
          return;
        }

        if (responseMessages === undefined || responseMessages.length === 0) {
          return;
        }

        const graphHistory: ModelMessage[] = [
          ...baseHistory,
          ...responseMessages,
        ];

        const result = await runGraphAgent({
          model: resolvedModel,
          providerOptions: resolvedProviderOptions,
          messages: graphHistory,
        });

        const updatedGraphMessages: ModelMessage[] = [
          ...graphHistory,
          ...result.responseMessages,
        ];

        replaceGraphMessages(chatId, updatedGraphMessages);
        publishGraphUpdate(chatId, updatedGraphMessages);
      } catch (error: unknown) {
        console.error("[graph-agent] failed:", error);
      }
    });
  };

  return {
    streamResult,
    runBackgroundTasks,
  };
}
