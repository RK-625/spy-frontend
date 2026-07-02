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
        className="max-w-md border-[rgba(200,172,251,0.12)] bg-[#0a0516]/95 backdrop-blur-md"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-terminal)] text-lg tracking-widest text-[#e8dff8] uppercase">
            Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-[#7a7685]">
            Spy session state and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-[var(--radius)] border border-[rgba(200,172,251,0.08)] bg-[rgba(10,5,22,0.5)] p-3">
            <div className="mb-1 text-[0.7rem] tracking-wider text-[#7a7685] uppercase">
              Model
            </div>
            <div className="font-mono text-[#e8dff8]">{model}</div>
          </div>

          <div className="rounded-[var(--radius)] border border-[rgba(200,172,251,0.08)] bg-[rgba(10,5,22,0.5)] p-3">
            <div className="mb-1 text-[0.7rem] tracking-wider text-[#7a7685] uppercase">
              Status
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span
                className={`inline-block size-1.5 rounded-full ${
                  status === "streaming"
                    ? "animate-pulse bg-[#C8ACFB]"
                    : status === "error"
                      ? "bg-red-400"
                      : "bg-emerald-400"
                }`}
              />
              <span className="text-[#e8e4df] capitalize">{status}</span>
            </div>
          </div>

          <div className="rounded-[var(--radius)] border border-[rgba(200,172,251,0.08)] bg-[rgba(10,5,22,0.5)] p-3">
            <div className="mb-1 text-[0.7rem] tracking-wider text-[#7a7685] uppercase">
              Messages
            </div>
            <div className="font-mono text-[#e8e4df]">{messageCount}</div>
          </div>

          {error && (
            <div className="rounded-[var(--radius)] border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              {error.message}
            </div>
          )}

          <p className="mt-2 text-xs text-[#7a7685]">
            Theme, key bindings, and account preferences will be available in a
            future release.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
