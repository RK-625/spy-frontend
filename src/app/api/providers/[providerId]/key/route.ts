import { NextResponse } from "next/server";
import { providers } from "@/lib/providers/registry";
import { deleteProviderKey, saveProviderKey } from "@/lib/providers/keys/keychain";
import { toKeyHint } from "@/lib/providers/keys/resolve-key";
import {
  isSameOriginJsonRequest,
  isSameOriginRequest,
} from "@/lib/providers/keys/same-origin";
import { verifyProviderKey } from "@/lib/providers/keys/verify-key";
import type { ProviderDefinition, ProviderKeyStatus } from "@/types/models";

/** Keychain access is a native module — must not run on Edge. */
export const runtime = "nodejs";

const MAX_API_KEY_LENGTH = 512;

interface ProviderKeyRouteContext {
  params: Promise<{ providerId: string }>;
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function readApiKey(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("apiKey" in body)) {
    return null;
  }
  const { apiKey } = body;
  if (typeof apiKey !== "string") {
    return null;
  }
  const trimmed = apiKey.trim();
  const isWellFormed =
    trimmed.length > 0 &&
    trimmed.length <= MAX_API_KEY_LENGTH &&
    !/\s/.test(trimmed);
  return isWellFormed ? trimmed : null;
}

/** Verify a pasted key with the provider, then save it to the OS keychain. */
export async function POST(
  request: Request,
  ctx: ProviderKeyRouteContext,
) {
  if (!isSameOriginJsonRequest(request)) {
    return errorResponse("Cross-origin or non-JSON request refused", 403);
  }

  const { providerId } = await ctx.params;
  const provider: ProviderDefinition | undefined = providers.find(
    (entry) => entry.id === providerId,
  );
  if (!provider) {
    return errorResponse(`Unknown provider: ${providerId}`, 404);
  }

  const apiKey = readApiKey(await request.json().catch(() => null));
  if (!apiKey) {
    return errorResponse("apiKey must be a non-empty string without spaces", 400);
  }

  const verification = await verifyProviderKey(provider.id, apiKey);
  if (verification.status === "invalid") {
    return errorResponse(`${provider.name} rejected this API key`, 422);
  }
  if (verification.status === "unreachable") {
    console.warn(
      `[provider-keys] could not verify ${provider.id}: ${verification.detail}`,
    );
    return errorResponse(
      `Could not reach ${provider.name} to verify the key. Try again.`,
      502,
    );
  }

  try {
    await saveProviderKey(provider.id, apiKey);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[provider-keys] keychain save failed for ${provider.id}: ${message}`);
    return errorResponse("Could not save the key to the system keychain", 500);
  }

  const status: ProviderKeyStatus = {
    id: provider.id,
    keyHint: toKeyHint(apiKey),
  };
  return NextResponse.json({ ok: true, provider: status });
}

/** Remove a provider's saved key from the OS keychain. */
export async function DELETE(
  request: Request,
  ctx: ProviderKeyRouteContext,
) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("Cross-origin request refused", 403);
  }

  const { providerId } = await ctx.params;
  const provider: ProviderDefinition | undefined = providers.find(
    (entry) => entry.id === providerId,
  );
  if (!provider) {
    return errorResponse(`Unknown provider: ${providerId}`, 404);
  }

  try {
    await deleteProviderKey(provider.id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[provider-keys] keychain delete failed for ${provider.id}: ${message}`);
    return errorResponse("Could not remove the key from the system keychain", 500);
  }

  const status: ProviderKeyStatus = { id: provider.id, keyHint: null };
  return NextResponse.json({ ok: true, provider: status });
}
