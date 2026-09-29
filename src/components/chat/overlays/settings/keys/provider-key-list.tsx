"use client";

import type { ProviderDefinition } from "@/types/models";
import { ProviderKeyRow, type ProviderKeyRowProps } from "./provider-key-row";
import type { ProviderKeyHints } from "./use-provider-keys";

export interface ProviderKeyListProps {
  providers: ProviderDefinition[];
  /** null while the key status is still loading. */
  keyHints: ProviderKeyHints | null;
  onSaveKey: ProviderKeyRowProps["onSaveKey"];
  onRemoveKey: ProviderKeyRowProps["onRemoveKey"];
}

export function ProviderKeyList({
  providers,
  keyHints,
  onSaveKey,
  onRemoveKey,
}: ProviderKeyListProps) {
  return (
    <div className="flex flex-col">
      {providers.map((provider) => (
        <ProviderKeyRow
          key={provider.id}
          keyHint={keyHints ? (keyHints[provider.id] ?? null) : undefined}
          onRemoveKey={onRemoveKey}
          onSaveKey={onSaveKey}
          provider={provider}
        />
      ))}
    </div>
  );
}
