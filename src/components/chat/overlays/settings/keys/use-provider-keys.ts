"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProviderId, ProviderKeyStatus } from "@/types/models";

/** Last 4 characters of each saved key; null = no key saved. */
export type ProviderKeyHints = Partial<Record<ProviderId, string | null>>;

export type SaveProviderKeyResult = { ok: true } | { ok: false; error: string };
export type RemoveProviderKeyResult = SaveProviderKeyResult;

interface ProviderKeysResponse {
  ok: boolean;
  providers?: ProviderKeyStatus[];
  provider?: ProviderKeyStatus;
  error?: string;
}

const NETWORK_ERROR = "Could not reach Spy. Check that the app is running.";

function toHints(statuses: ProviderKeyStatus[]): ProviderKeyHints {
  return Object.fromEntries(statuses.map((status) => [status.id, status.keyHint]));
}

/** Loads key status when `enabled` turns on; saves verified keys via the API. */
export function useProviderKeys(enabled: boolean) {
  const [keyHints, setKeyHints] = useState<ProviderKeyHints | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch("/api/providers", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.json() as Promise<ProviderKeysResponse>)
      .then((body) => {
        if (!body.ok || !body.providers) {
          setLoadError(body.error ?? "Could not load provider keys.");
          return;
        }
        setLoadError(null);
        setKeyHints(toHints(body.providers));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[settings] provider keys load failed:", error);
        setLoadError(NETWORK_ERROR);
      });
    return () => controller.abort();
  }, [enabled]);

  const saveProviderKey = useCallback(
    async (providerId: ProviderId, apiKey: string): Promise<SaveProviderKeyResult> => {
      let body: ProviderKeysResponse;
      try {
        const response = await fetch(`/api/providers/${providerId}/key`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey }),
        });
        body = (await response.json()) as ProviderKeysResponse;
      } catch (error: unknown) {
        console.error("[settings] provider key save failed:", error);
        return { ok: false, error: NETWORK_ERROR };
      }
      if (!body.ok || !body.provider) {
        return { ok: false, error: body.error ?? "Could not save the key." };
      }
      const saved = body.provider;
      setKeyHints((previous) => ({ ...previous, [saved.id]: saved.keyHint }));
      return { ok: true };
    },
    [],
  );

  const removeProviderKey = useCallback(
    async (providerId: ProviderId): Promise<RemoveProviderKeyResult> => {
      let body: ProviderKeysResponse;
      try {
        const response = await fetch(`/api/providers/${providerId}/key`, {
          method: "DELETE",
        });
        body = (await response.json()) as ProviderKeysResponse;
      } catch (error: unknown) {
        console.error("[settings] provider key remove failed:", error);
        return { ok: false, error: NETWORK_ERROR };
      }
      if (!body.ok || !body.provider) {
        return { ok: false, error: body.error ?? "Could not remove the key." };
      }
      const removed = body.provider;
      setKeyHints((previous) => ({ ...previous, [removed.id]: removed.keyHint }));
      return { ok: true };
    },
    [],
  );

  return { keyHints, loadError, saveProviderKey, removeProviderKey };
}
