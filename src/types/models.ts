import type React from "react";

export type Chef = string;
export type ModelId = string;

export type ProviderId = "deepseek" | "meta" | "openai" | "anthropic" | "google";

/** What the app uses a provider for; embeddings run outside the model picker. */
export type ProviderCapability = "chat" | "embeddings";

export type ProviderIcon = React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

/** A chat model as declared inside its provider's registry entry. */
export interface ProviderModel {
  id: ModelId;
  name: string;
  mode: string[];
  defaultMode: string;
}

export interface ProviderDefinition {
  id: ProviderId;
  name: Chef;
  icon: ProviderIcon;
  /** Env var read when no key is saved in the app. */
  envKey: string;
  capabilities: ProviderCapability[];
  models: ProviderModel[];
}

/** Where a provider's key came from: saved in the app (OS keychain) or `.env`. */
export type ProviderKeySource = "app" | "env";

/** Key presence only — the key itself never leaves the server. */
export interface ProviderKeyStatus {
  id: ProviderId;
  keySource: ProviderKeySource | null;
}

/** A chat model flattened with its provider, as the model picker consumes it. */
export interface AIModel extends ProviderModel {
  chef: Chef;
  chefSlug: ProviderId;
  icon: ProviderIcon;
}
