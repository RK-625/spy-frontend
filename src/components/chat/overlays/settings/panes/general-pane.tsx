"use client";

import { useChatContext } from "@/contexts/ChatContext";
import { SettingsPaneHeader } from "./settings-pane-header";

const cardClassName =
  "rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3";
const cardLabelClassName = "mb-1 text-[0.7rem] tracking-wider text-text-secondary uppercase";

export function GeneralPane() {
  const { status, messages, error } = useChatContext();

  return (
    <>
      <SettingsPaneHeader description="Spy session state and preferences." title="General" />
      <div className="flex flex-col gap-3 text-sm">
        <div className={cardClassName}>
          <div className={cardLabelClassName}>Status</div>
          <div className="flex items-center gap-2 font-mono">
            <span
              className={`inline-block size-1.5 rounded-[var(--radius-badge)] ${
                status === "streaming"
                  ? "animate-pulse bg-status-dot-streaming"
                  : status === "error"
                    ? "bg-status-dot-error"
                    : "bg-status-dot-ready"
              }`}
            />
            <span className="text-text-primary capitalize">{status}</span>
          </div>
        </div>

        <div className={cardClassName}>
          <div className={cardLabelClassName}>Messages</div>
          <div className="font-mono text-text-primary">{messages.length}</div>
        </div>

        {error && (
          <div className="rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive-foreground">
            {error.message}
          </div>
        )}

        <p className="mt-2 text-xs text-text-secondary">
          Theme, key bindings, and account preferences will be available in a future release.
        </p>
      </div>
    </>
  );
}
