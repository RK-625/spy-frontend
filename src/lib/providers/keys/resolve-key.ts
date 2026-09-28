/**
 * Server-only: which API key a provider uses — saved in the app first,
 * then the provider's `.env` var.
 */
import { getProvider, providers } from "@/lib/providers/registry";
import type {
  ProviderId,
  ProviderKeySource,
  ProviderKeyStatus,
} from "@/types/models";
import { readSavedProviderKey } from "./keychain";

export interface ResolvedProviderKey {
  apiKey: string;
  source: ProviderKeySource;
}

/** Thrown when a model's provider has no key; routes map it to a 400. */
export class MissingProviderKeyError extends Error {
  readonly providerId: ProviderId;

  constructor(providerId: ProviderId) {
    const { name } = getProvider(providerId);
    super(`No API key for ${name}. Add it in Settings.`);
    this.name = "MissingProviderKeyError";
    this.providerId = providerId;
  }
}

async function readSavedKeyOrNull(
  providerId: ProviderId,
): Promise<string | null> {
  try {
    return await readSavedProviderKey(providerId);
  } catch (error: unknown) {
    // Keychain can be locked or missing (e.g. headless Linux); env still works.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[provider-keys] keychain read failed for ${providerId}: ${message}`);
    return null;
  }
}

export async function resolveProviderKey(
  providerId: ProviderId,
): Promise<ResolvedProviderKey | null> {
  const savedKey = await readSavedKeyOrNull(providerId);
  if (savedKey) {
    return { apiKey: savedKey, source: "app" };
  }
  const envKey = process.env[getProvider(providerId).envKey];
  if (envKey) {
    return { apiKey: envKey, source: "env" };
  }
  return null;
}

export async function requireProviderKey(providerId: ProviderId): Promise<string> {
  const resolved = await resolveProviderKey(providerId);
  if (!resolved) {
    throw new MissingProviderKeyError(providerId);
  }
  return resolved.apiKey;
}

export async function listProviderKeyStatuses(): Promise<ProviderKeyStatus[]> {
  return Promise.all(
    providers.map(async (provider) => ({
      id: provider.id,
      keySource: (await resolveProviderKey(provider.id))?.source ?? null,
    })),
  );
}
