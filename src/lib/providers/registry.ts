/**
 * Provider registry — the single client-safe source of truth for providers and
 * their chat models. Server-only SDK wiring lives in `@/ai/models/modelstore`.
 */
import {
  AnthropicWhite,
  Deepseek,
  Google,
  Meta,
  OpenAIDark,
} from "@/components/logos";
import type {
  AIModel,
  ProviderDefinition,
  ProviderId,
} from "@/types/models";

export const providers: ProviderDefinition[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: Deepseek,
    keyPrefix: "sk-",
    capabilities: ["chat"],
    models: [
      {
        id: "deepseek-flash",
        name: "DeepSeek Flash",
        mode: ["high", "max"],
        defaultMode: "high",
      },
    ],
  },
  {
    id: "meta",
    name: "Meta",
    icon: Meta,
    keyPrefix: "",
    capabilities: ["chat"],
    models: [
      {
        id: "muse-spark-1.3-contributor",
        name: "Muse Spark 1.3 Contributor",
        mode: ["minimal", "low", "medium", "high", "xhigh", "max"],
        defaultMode: "high",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: OpenAIDark,
    keyPrefix: "sk-",
    capabilities: ["chat"],
    models: [
      {
        id: "gpt-6-sol",
        name: "GPT-6 Sol",
        mode: ["none", "low", "medium", "high", "xhigh", "max"],
        defaultMode: "medium",
      },
      {
        id: "gpt-6-luna",
        name: "GPT-6 Luna",
        mode: ["none", "low", "medium", "high", "xhigh", "max"],
        defaultMode: "medium",
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: AnthropicWhite,
    keyPrefix: "sk-ant-",
    capabilities: ["chat"],
    models: [
      {
        id: "claude-opus-5-5",
        name: "Claude Opus 5.5",
        mode: ["low", "medium", "high", "xhigh", "max"],
        defaultMode: "medium",
      },
      {
        id: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        mode: ["low", "medium", "high", "xhigh", "max"],
        defaultMode: "high",
      },
    ],
  },
  {
    id: "google",
    name: "Google",
    icon: Google,
    keyPrefix: "AIza",
    capabilities: ["chat", "embeddings"],
    models: [
      {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        mode: ["low", "medium", "high"],
        defaultMode: "medium",
      },
    ],
  },
];

export function getProvider(providerId: ProviderId): ProviderDefinition {
  const provider = providers.find((entry) => entry.id === providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider;
}

export const models: AIModel[] = providers.flatMap((provider) =>
  provider.models.map((model) => ({
    ...model,
    chef: provider.name,
    chefSlug: provider.id,
    icon: provider.icon,
  })),
);

/** Providers with at least one chat model, in registry order (model picker groups). */
export const chefs: string[] = providers
  .filter((provider) => provider.models.length > 0)
  .map((provider) => provider.name);
