"use client";

import { useCallback } from "react";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import type { ProviderDefinition } from "@/types/models";
import { ProviderKeyField } from "./provider-key-field";
import type { RemoveProviderKeyResult, SaveProviderKeyResult } from "@/contexts/ProviderKeysContext";

export interface ProviderKeyRowProps {
  provider: ProviderDefinition;
  keyHint: string | null | undefined;
  onSaveKey: (provider: ProviderDefinition, apiKey: string) => Promise<SaveProviderKeyResult>;
  onRemoveKey: (provider: ProviderDefinition) => Promise<RemoveProviderKeyResult>;
}

/** What a non-chat provider's key unlocks, shown under its name. */
function providerRequirementLabel(provider: ProviderDefinition): string | null {
  if (provider.capabilities.includes("embeddings")) return "Needed for embeddings";
  if (provider.capabilities.includes("webSearch")) return "Needed for web search";
  return null;
}

export function ProviderKeyRow({ provider, keyHint, onSaveKey, onRemoveKey }: ProviderKeyRowProps) {
  const Icon = provider.icon;
  const requirementLabel = providerRequirementLabel(provider);
  const handleSaveKey = useCallback(
    (apiKey: string) => onSaveKey(provider, apiKey),
    [onSaveKey, provider],
  );
  const handleRemoveKey = useCallback(
    () => onRemoveKey(provider),
    [onRemoveKey, provider],
  );

  return (
    <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] py-3 last:border-b-0">
      <div className="flex h-9 w-40 flex-none items-center gap-2.5">
        <Icon aria-hidden height={ICON_GLYPH.toolbar} width={ICON_GLYPH.toolbar} />
        <div className="min-w-0">
          <div className="text-sm leading-tight font-medium text-text-primary">{provider.name}</div>
          {requirementLabel && (
            <div className="text-[0.7rem] leading-snug whitespace-nowrap text-lavender">
              {requirementLabel}
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <ProviderKeyField
          keyHint={keyHint}
          onRemoveKey={handleRemoveKey}
          onSaveKey={handleSaveKey}
          provider={provider}
        />
      </div>
    </div>
  );
}
