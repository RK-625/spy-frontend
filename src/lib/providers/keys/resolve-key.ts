/**
 * Server-only: provider API keys come from the OS keychain only. Every saved
 * key passed the provider's check on save, so present means verified.
 */
import { getProvider, providers } from "@/lib/providers/registry";
import type { ProviderId, ProviderKeyStatus } from "@/types/models";
import { readSavedProviderKey } from "./keychain";

const KEY_HINT_LENGTH = 4;

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

/** The saved key, or null when none is saved or the keychain can't be read. */
export async function readSavedKeyOrNull(
  providerId: ProviderId,
): Promise<string | null> {
  try {
    return await readSavedProviderKey(providerId);
  } catch (error: unknown) {
    // Keychain can be locked or missing (e.g. headless Linux).
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[provider-keys] keychain read failed for ${providerId}: ${message}`);
    return null;
  }
}

export function toKeyHint(apiKey: string): string {
  return apiKey.slice(-KEY_HINT_LENGTH);
}

export async function requireProviderKey(providerId: ProviderId): Promise<string> {
  const apiKey = await readSavedKeyOrNull(providerId);
  if (!apiKey) {
    throw new MissingProviderKeyError(providerId);
  }
  return apiKey;
}

export async function listProviderKeyStatuses(): Promise<ProviderKeyStatus[]> {
  return Promise.all(
    providers.map(async (provider) => {
      const apiKey = await readSavedKeyOrNull(provider.id);
      return { id: provider.id, keyHint: apiKey ? toKeyHint(apiKey) : null };
    }),
  );
}
