"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChatContext } from "@/contexts/ChatContext";

export function SettingsDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (b: boolean) => void;
  open: boolean;
}) {
  const { model, status, messages, error } = useChatContext();
  const messageCount = messages.length;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-md border-[var(--border-medium)] bg-[var(--surface-elevated)]/95 backdrop-blur-md"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-terminal)] text-lg tracking-widest text-primary uppercase">
            Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Spy session state and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
            <div className="mb-1 text-[0.7rem] tracking-wider text-text-secondary uppercase">
              Model
            </div>
            <div className="font-mono text-primary">{model}</div>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
            <div className="mb-1 text-[0.7rem] tracking-wider text-text-secondary uppercase">
              Status
            </div>
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

          <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
            <div className="mb-1 text-[0.7rem] tracking-wider text-text-secondary uppercase">
              Messages
            </div>
            <div className="font-mono text-text-primary">{messageCount}</div>
          </div>

          {error && (
            <div className="rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              {error.message}
            </div>
          )}

          <p className="mt-2 text-xs text-text-secondary">
            Theme, key bindings, and account preferences will be available in a
            future release.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
