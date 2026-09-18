import { streamText } from "ai";
import { slimJson } from "../../slim-json";

type StreamTextOptions = Parameters<typeof streamText>[0];

/**
 * ChatAgent stream. Orchestrator owns conversion, tools, model, and stopWhen.
 */
export function runChatAgent({
  model,
  providerOptions,
  messages,
  instructions,
  tools,
  stopWhen,
}: {
  model: StreamTextOptions["model"];
  providerOptions: StreamTextOptions["providerOptions"];
  messages: NonNullable<StreamTextOptions["messages"]>;
  instructions: StreamTextOptions["instructions"];
  tools: StreamTextOptions["tools"];
  stopWhen: StreamTextOptions["stopWhen"];
}) {
  return streamText({
    model,
    instructions,
    messages,
    tools,
    stopWhen,
    providerOptions,
    onToolExecutionEnd(event) {
      const { toolCall, toolExecutionMs, toolOutput } = event;
      const payload = {
        seconds: toolExecutionMs / 1000,
        input: toolCall.input,
        ...(toolOutput.type === "tool-result"
          ? { output: slimJson(toolOutput.output) }
          : { error: slimJson(toolOutput.error) }),
      };
      if (toolOutput.type === "tool-result") {
        console.log(`[tool] ${toolCall.toolName}`);
        console.dir(payload, { depth: null });
      } else {
        console.error(`[tool] ${toolCall.toolName}`);
        console.dir(payload, { depth: null });
      }
    },
  });
}
