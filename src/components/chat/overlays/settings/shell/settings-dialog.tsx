"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import type { ProviderDefinition } from "@/types/models";
import { useProviderKeys } from "@/contexts/ProviderKeysContext";
import { GeneralPane } from "../panes/general-pane";
import {
  EmbeddingsPane,
  embeddingProviders,
  ProvidersPane,
  ToolsPane,
} from "../panes/provider-panes";
import { SettingsNav, type SettingsPaneId } from "./settings-nav";

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePaneId: SettingsPaneId;
  onActivePaneChange: (paneId: SettingsPaneId) => void;
}

export function SettingsDialog({
  onOpenChange,
  open,
  activePaneId,
  onActivePaneChange,
}: SettingsDialogProps) {
  const { keyHints, loadError, reloadProviderKeys, saveProviderKey, removeProviderKey } =
    useProviderKeys();

  // Opening Settings retries a failed status load.
  useEffect(() => {
    if (open && loadError) reloadProviderKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retry once per open, not per error change
  }, [open]);

  const handleSaveKey = useCallback(
    (provider: ProviderDefinition, apiKey: string) => saveProviderKey(provider.id, apiKey),
    [saveProviderKey],
  );
  const handleRemoveKey = useCallback(
    (provider: ProviderDefinition) => removeProviderKey(provider.id),
    [removeProviderKey],
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
          onSelectPane={onActivePaneChange}
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
                <ProvidersPane
                  keyHints={keyHints}
                  loadError={loadError}
                  onRemoveKey={handleRemoveKey}
                  onSaveKey={handleSaveKey}
                />
              )}
              {activePaneId === "embeddings" && (
                <EmbeddingsPane
                  isEmbeddingKeyMissing={isEmbeddingKeyMissing}
                  keyHints={keyHints}
                  loadError={loadError}
                  onRemoveKey={handleRemoveKey}
                  onSaveKey={handleSaveKey}
                />
              )}
              {activePaneId === "tools" && (
                <ToolsPane
                  keyHints={keyHints}
                  loadError={loadError}
                  onRemoveKey={handleRemoveKey}
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
