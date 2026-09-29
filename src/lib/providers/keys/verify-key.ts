/**
 * Server-only: checks a pasted key against the provider's list-models
 * endpoint — free, and independent of which models the registry lists.
 * Exa has no free check for normal keys, so it runs one instant search
 * (about $0.004); a bad key is rejected with 401 at no cost.
 */
import type { ProviderId } from "@/types/models";

export type KeyVerification =
  | { status: "valid" }
  | { status: "invalid" }
  | { status: "unreachable"; detail: string };

interface KeyCheckRequest {
  url: string;
  headers: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
}

const VERIFY_TIMEOUT_MS = 10_000;

function bearer(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

const keyCheckRequests: Record<ProviderId, (apiKey: string) => KeyCheckRequest> = {
  openai: (apiKey) => ({
    url: "https://api.openai.com/v1/models",
    headers: bearer(apiKey),
  }),
  anthropic: (apiKey) => ({
    url: "https://api.anthropic.com/v1/models",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  }),
  google: (apiKey) => ({
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    headers: { "x-goog-api-key": apiKey },
  }),
  deepseek: (apiKey) => ({
    url: "https://api.deepseek.com/models",
    headers: bearer(apiKey),
  }),
  meta: (apiKey) => ({
    url: "https://api.meta.ai/v1/models",
    headers: bearer(apiKey),
  }),
  exa: (apiKey) => ({
    url: "https://api.exa.ai/search",
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ query: "exa", numResults: 1, type: "instant" }),
  }),
};

/** Google answers a bad key with 400 (API_KEY_INVALID); the others use 401/403. */
const REJECTED_KEY_STATUSES = new Set([400, 401, 403]);

export async function verifyProviderKey(
  providerId: ProviderId,
  apiKey: string,
): Promise<KeyVerification> {
  const { url, headers, method = "GET", body } = keyCheckRequests[providerId](apiKey);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return { status: "unreachable", detail };
  }
  if (response.ok) {
    return { status: "valid" };
  }
  if (REJECTED_KEY_STATUSES.has(response.status)) {
    return { status: "invalid" };
  }
  return { status: "unreachable", detail: `HTTP ${response.status}` };
}
