"use client";

import { motion } from "motion/react";
import { DialogTitle } from "@/components/ui";
import { MOTION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { SettingsPaneId } from "@/types/chat";

export type { SettingsPaneId };

const settingsPanes: { id: SettingsPaneId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "providers", label: "Providers" },
  { id: "embeddings", label: "Embeddings" },
  { id: "tools", label: "Tools" },
];

export interface SettingsNavProps {
  activePaneId: SettingsPaneId;
  onSelectPane: (paneId: SettingsPaneId) => void;
  /** Panes that need attention (e.g. a missing required key) get a dot. */
  attentionPaneIds: SettingsPaneId[];
}

export function SettingsNav({ activePaneId, onSelectPane, attentionPaneIds }: SettingsNavProps) {
  return (
    <nav className="flex w-[var(--settings-nav-w)] flex-none flex-col gap-1 border-r border-[var(--border-subtle)] px-3 py-5">
      <DialogTitle className="px-2.5 pb-3.5 font-[family-name:var(--font-terminal)] text-xl tracking-widest text-primary uppercase">
        Settings
      </DialogTitle>
      {settingsPanes.map((pane) => {
        const isActive = pane.id === activePaneId;
        const needsAttention = attentionPaneIds.includes(pane.id);
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex items-center justify-between rounded-[var(--radius)] px-2.5 py-2 text-left text-sm transition-colors duration-[var(--duration-fast)]",
              isActive ? "text-primary" : "text-lavender-muted hover:text-primary-hover",
            )}
            key={pane.id}
            onClick={() => onSelectPane(pane.id)}
            type="button"
          >
            {isActive && (
              <motion.span
                className="absolute inset-0 rounded-[var(--radius)] bg-[var(--surface-hover)]"
                layoutId="settings-nav-highlight"
                transition={MOTION.spring}
              />
            )}
            <span className="relative">{pane.label}</span>
            {needsAttention && (
              <motion.span
                animate={{ opacity: 1, scale: 1 }}
                className="relative size-1.5 rounded-full bg-status-dot-error"
                initial={{ opacity: 0, scale: 0.8 }}
                title="Key needed"
                transition={MOTION.chrome}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
