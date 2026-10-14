"use client";

import { useChatContext } from "@/contexts/ChatContext";
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_CARD_LABEL_CLASS,
  SettingsPaneHeader,
} from "./settings-pane-chrome";

export function GeneralPane() {
  const { status, messages, error } = useChatContext();

  return (
    <>
      <SettingsPaneHeader description="Spy session state and preferences." title="General" />
      <div className="flex flex-col gap-3 text-sm">
        <div className={SETTINGS_CARD_CLASS}>
          <div className={SETTINGS_CARD_LABEL_CLASS}>Status</div>
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

        <div className={SETTINGS_CARD_CLASS}>
          <div className={SETTINGS_CARD_LABEL_CLASS}>Messages</div>
          <div className="font-mono text-text-primary">{messages.length}</div>
        </div>

        {error && (
          <div className="rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive-foreground">
            {error.message}
          </div>
        )}

        <p className="mt-2 text-xs text-text-secondary">
          Key bindings and account preferences will be available in a future release.
        </p>
      </div>
    </>
  );
}
