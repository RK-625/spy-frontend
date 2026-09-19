import { generateText, isStepCount } from "ai";
import { slimJson } from "../../slim-json";
import { createGraphToolSet } from "../../tools/agent-toolsets";
import { buildGraphInstructions } from "@/prompts/graph-instructions";

type GenerateTextOptions = Parameters<typeof generateText>[0];

/**
 * GraphAgent generateText. Silent; not streamed to the UI.
 */
export async function runGraphAgent({
  model,
  providerOptions,
  messages,
}: {
  model: GenerateTextOptions["model"];
  providerOptions: GenerateTextOptions["providerOptions"];
  messages: NonNullable<GenerateTextOptions["messages"]>;
}) {
  return generateText({
    model,
    providerOptions,
    instructions: buildGraphInstructions(),
    tools: createGraphToolSet(),
    messages,
    stopWhen: isStepCount(15),
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
        console.log(`[graph-tool] ${toolCall.toolName}`);
        console.dir(payload, { depth: null });
      } else {
        console.error(`[graph-tool] ${toolCall.toolName}`);
        console.dir(payload, { depth: null });
      }
    },
  });
}
