import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { getProvider, models } from "@/lib/providers/registry";
import type { ProviderId } from "@/types/models";
import { EmbeddingModel, LanguageModel } from "ai";
import { type SharedV4ProviderOptions } from "@ai-sdk/provider";

interface ResolvedModel {
  model: LanguageModel;
  providerOptions?: SharedV4ProviderOptions;
}

type ChatModelFactory = (args: {
  apiKey: string;
  modelId: string;
  mode: string;
}) => ResolvedModel;

function resolveProviderApiKey(providerId: ProviderId): string {
  const { envKey } = getProvider(providerId);
  const apiKey = process.env[envKey];
  if (!apiKey) {
    throw new Error(`${envKey} is not set`);
  }
  return apiKey;
}

const chatModelFactories: Record<ProviderId, ChatModelFactory> = {
  openai: ({ apiKey, modelId, mode }) => ({
    model: createOpenAI({ apiKey })(modelId),
    providerOptions: mode ? { openai: { reasoningEffort: mode } } : undefined,
  }),
  anthropic: ({ apiKey, modelId, mode }) => ({
    model: createAnthropic({ apiKey })(modelId),
    providerOptions: mode ? { anthropic: { effort: mode } } : undefined,
  }),
  google: ({ apiKey, modelId }) => ({
    model: createGoogleGenerativeAI({ apiKey })(modelId),
    providerOptions: undefined,
  }),
  deepseek: ({ apiKey, modelId, mode }) => ({
    model: createDeepSeek({ apiKey })(modelId),
    providerOptions: mode
      ? { deepseek: { reasoningEffort: mode } }
      : undefined,
  }),
  meta: ({ apiKey, modelId, mode }) => ({
    model: createOpenAI({
      name: "meta",
      baseURL: "https://api.meta.ai/v1",
      apiKey,
    })(modelId),
    providerOptions: {
      openai: {
        forceReasoning: true,
        include: ["reasoning.encrypted_content"],
        ...(mode ? { reasoningEffort: mode } : {}),
      },
    },
  }),
};

export const modelConfig = ({
  model,
  mode,
}: {
  model: string;
  mode: string;
}): ResolvedModel => {
  const found = models.find((entry) => entry.id === model);
  if (!found) {
    throw new Error(`Unknown model: ${model}`);
  }
  return chatModelFactories[found.chefSlug]({
    apiKey: resolveProviderApiKey(found.chefSlug),
    modelId: model,
    mode,
  });
};

// Right now only Google embeddings are supported
export const embedModel = (): EmbeddingModel => {
  return createGoogleGenerativeAI({
    apiKey: resolveProviderApiKey("google"),
  }).embedding("gemini-embedding-2");
};
