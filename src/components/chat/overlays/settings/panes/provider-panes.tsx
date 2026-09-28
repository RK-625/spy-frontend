"use client";

/**
 * Providers (chat models) and Embeddings panes. Split by registry capability:
 * embedding providers live only in Embeddings, never in the model picker.
 */

import { AnimatePresence, motion } from "motion/react";
import { Google } from "@/components/logos";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import { providers } from "@/lib/providers/registry";
import { ProviderKeyList, type ProviderKeyListProps } from "../keys/provider-key-list";
import { SettingsPaneHeader } from "./settings-pane-header";

export const chatProviders = providers.filter(
  (provider) => !provider.capabilities.includes("embeddings"),
);
export const embeddingProviders = providers.filter((provider) =>
  provider.capabilities.includes("embeddings"),
);

type ProviderPaneProps = Pick<ProviderKeyListProps, "keyHints" | "onSaveKey"> & {
  loadError: string | null;
};

function LoadErrorNotice({ loadError }: { loadError: string | null }) {
  if (!loadError) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {loadError}
    </p>
  );
}

export function ProvidersPane({ keyHints, loadError, onSaveKey }: ProviderPaneProps) {
  return (
    <>
      <SettingsPaneHeader
        description="Add API keys for the models Spy chats with."
        title="Providers"
      />
      <LoadErrorNotice loadError={loadError} />
      <ProviderKeyList keyHints={keyHints} onSaveKey={onSaveKey} providers={chatProviders} />
    </>
  );
}

export function EmbeddingsPane({
  keyHints,
  loadError,
  onSaveKey,
  isEmbeddingKeyMissing,
}: ProviderPaneProps & { isEmbeddingKeyMissing: boolean }) {
  return (
    <>
      <SettingsPaneHeader
        description="Turns your notes into searchable memory."
        title="Embeddings"
      />
      <AnimatePresence initial={false}>
        {isEmbeddingKeyMissing && (
          <motion.div
            {...CHROME_FADE}
            className="flex gap-3 rounded-[var(--radius)] border border-[var(--glow-line)] bg-[var(--surface-hover)] px-3.5 py-3"
            transition={MOTION.chrome}
          >
            <Google
              aria-hidden
              className="mt-0.5 flex-none"
              height={ICON_GLYPH.inline}
              width={ICON_GLYPH.inline}
            />
            <p className="text-sm leading-normal">
              <span className="font-medium text-text-primary">Google key required.</span>{" "}
              <span className="text-lavender-muted">
                Spy uses Google embeddings to index your notes into the graph. Add a key to turn
                on memory and search.
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <LoadErrorNotice loadError={loadError} />
      <ProviderKeyList keyHints={keyHints} onSaveKey={onSaveKey} providers={embeddingProviders} />
    </>
  );
}
