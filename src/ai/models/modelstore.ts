import { createOpenAI, openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { deepseek } from "@ai-sdk/deepseek";
import { models } from "@/lib/models";
import type { AIModel } from "@/types/models";
import { EmbeddingModel, LanguageModel } from "ai";
import { type SharedV4ProviderOptions } from "@ai-sdk/provider";

let metaProvider: ReturnType<typeof createOpenAI> | undefined;

function metaLanguageModel(modelId: string): LanguageModel {
  const apiKey = process.env.MUSE_SPARK_KEY;
  if (!apiKey) {
    throw new Error("MUSE_SPARK_KEY is not set");
  }
  metaProvider ??= createOpenAI({
    name: "meta",
    baseURL: "https://api.meta.ai/v1",
    apiKey,
  });
  return metaProvider(modelId);
}

export const modelConfig = ({
  model,
  mode,
}: {
  model: string;
  mode?: string;
}): { model: LanguageModel; providerOptions?: SharedV4ProviderOptions } => {
  const found = models.find((m: AIModel) => m.id === model);
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
    case "Meta":
      return {
        model: metaLanguageModel(model),
        providerOptions: {
          openai: {
            forceReasoning: true,
            include: ["reasoning.encrypted_content"],
            ...(mode ? { reasoningEffort: mode } : {}),
          },
        },
      };
    default:
      throw new Error(`Unknown model: ${model}`);
  }
};

// Right now only Google embeddings are supported
export const embedModel = (): EmbeddingModel => {
  return google.embedding("gemini-embedding-2");
};
