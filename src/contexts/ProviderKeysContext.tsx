"use client";

/**
 * Shared provider-key status: which providers have a verified key saved in the
 * OS keychain. Settings edits it; the model picker reads it. Only the last 4
 * characters of a key ever reach the browser.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

interface ProviderKeysContextValue {
  /** null until the first status load finishes (or fails). */
  keyHints: ProviderKeyHints | null;
  loadError: string | null;
  reloadProviderKeys: () => void;
  saveProviderKey: (providerId: ProviderId, apiKey: string) => Promise<SaveProviderKeyResult>;
  removeProviderKey: (providerId: ProviderId) => Promise<RemoveProviderKeyResult>;
}

const NETWORK_ERROR = "Could not reach Spy. Check that the app is running.";

const ProviderKeysContext = createContext<ProviderKeysContextValue | null>(null);

function toHints(statuses: ProviderKeyStatus[]): ProviderKeyHints {
  return Object.fromEntries(statuses.map((status) => [status.id, status.keyHint]));
}

export function ProviderKeysProvider({ children }: { children: ReactNode }) {
  const [keyHints, setKeyHints] = useState<ProviderKeyHints | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
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
        console.error("[provider-keys] load failed:", error);
        setLoadError(NETWORK_ERROR);
      });
    return () => controller.abort();
  }, [reloadCount]);

  const reloadProviderKeys = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

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
        console.error("[provider-keys] save failed:", error);
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
        console.error("[provider-keys] remove failed:", error);
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

  const value = useMemo(
    () => ({ keyHints, loadError, reloadProviderKeys, saveProviderKey, removeProviderKey }),
    [keyHints, loadError, reloadProviderKeys, saveProviderKey, removeProviderKey],
  );

  return <ProviderKeysContext.Provider value={value}>{children}</ProviderKeysContext.Provider>;
}

export function useProviderKeys(): ProviderKeysContextValue {
  const value = useContext(ProviderKeysContext);
  if (!value) {
    throw new Error("useProviderKeys must be used within a ProviderKeysProvider");
  }
  return value;
}
