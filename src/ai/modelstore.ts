import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { deepseek } from "@ai-sdk/deepseek";
import { models } from "../types/models";
import { LanguageModel } from "ai";
import { type SharedV3ProviderOptions } from "@ai-sdk/provider";

export const modelConfig = ({
  model,
  mode,
}: {
  model: string;
  mode?: string;
}): { model: LanguageModel; providerOptions?: SharedV3ProviderOptions } => {
  const found = models.find((m) => m.id === model);
  if (!found) {
    throw new Error(`Unknown model: ${model}`);
  }
  switch (found.chef) {
    case "OpenAI":
      return {
        model: openai(model),
        providerOptions: mode
          ? { openai: { reasoningEffort: mode } }
          : undefined,
      };
    case "Anthropic":
      return {
        model: anthropic(model),
        providerOptions: mode ? { anthropic: { effort: mode } } : undefined,
      };
    case "Google":
      return {
        model: google(model),
        providerOptions: undefined,
      };
    case "DeepSeek":
      return {
        model: deepseek(model),
        providerOptions: mode
          ? { deepseek: { reasoningEffort: mode } }
          : undefined,
      };
    default:
      throw new Error(`Unknown model: ${model}`);
  }
};
