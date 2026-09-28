"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import type { ProviderDefinition } from "@/types/models";
import { useProviderKeys } from "../keys/use-provider-keys";
import { GeneralPane } from "../panes/general-pane";
import { EmbeddingsPane, embeddingProviders, ProvidersPane } from "../panes/provider-panes";
import { SettingsNav, type SettingsPaneId } from "./settings-nav";

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ onOpenChange, open }: SettingsDialogProps) {
  const [activePaneId, setActivePaneId] = useState<SettingsPaneId>("general");
  const { keyHints, loadError, saveProviderKey } = useProviderKeys(open);

  const handleSaveKey = useCallback(
    (provider: ProviderDefinition, apiKey: string) => saveProviderKey(provider.id, apiKey),
    [saveProviderKey],
  );

  // Unknown until the status loads, so no dot flashes on open.
  const isEmbeddingKeyMissing =
    keyHints !== null && embeddingProviders.some((provider) => !keyHints[provider.id]);
  const attentionPaneIds: SettingsPaneId[] = isEmbeddingKeyMissing ? ["embeddings"] : [];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex h-[min(var(--settings-dialog-h),calc(100%-2rem))] gap-0 overflow-hidden rounded-[var(--radius)] border border-[var(--border-medium)] bg-[var(--surface-input-opaque)] p-0 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-md sm:max-w-[var(--settings-dialog-w)]"
        showCloseButton
      >
        <DialogDescription className="sr-only">
          Spy preferences, provider API keys and embeddings.
        </DialogDescription>
        <SettingsNav
          activePaneId={activePaneId}
          attentionPaneIds={attentionPaneIds}
          onSelectPane={setActivePaneId}
        />
        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              className="flex flex-col gap-4"
              key={activePaneId}
              {...CHROME_FADE}
              transition={MOTION.chrome}
            >
              {activePaneId === "general" && <GeneralPane />}
              {activePaneId === "providers" && (
                <ProvidersPane keyHints={keyHints} loadError={loadError} onSaveKey={handleSaveKey} />
              )}
              {activePaneId === "embeddings" && (
                <EmbeddingsPane
                  isEmbeddingKeyMissing={isEmbeddingKeyMissing}
                  keyHints={keyHints}
                  loadError={loadError}
                  onSaveKey={handleSaveKey}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
