/**
 * Server-only: provider API keys in the OS keychain (macOS Keychain,
 * Windows Credential Manager, Linux Secret Service). Never log key values.
 */
import { AsyncEntry } from "@napi-rs/keyring";
import type { ProviderId } from "@/types/models";

/** Matches the Electron appId so web and desktop share one keychain entry. */
const KEYCHAIN_SERVICE = "app.spy.desktop";

function providerKeyEntry(providerId: ProviderId): AsyncEntry {
  return new AsyncEntry(KEYCHAIN_SERVICE, `provider:${providerId}`);
}

export async function readSavedProviderKey(
  providerId: ProviderId,
): Promise<string | null> {
  const apiKey = await providerKeyEntry(providerId).getPassword();
  return apiKey ?? null;
}

export async function saveProviderKey(
  providerId: ProviderId,
  apiKey: string,
): Promise<void> {
  await providerKeyEntry(providerId).setPassword(apiKey);
}
