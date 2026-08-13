"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import type { MemoryNode } from "@/types/graph-schema";

function formatConfidence(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return `${pct}%`;
}

/**
 * Node-inspect modal — dark utility register, lavender accents.
 * Shows Memory name/content (and optional impression / confidence).
 */
export function NodeDetailDialog({
  node,
  open,
  onOpenChange,
}: {
  node: MemoryNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const title = node?.name?.trim() || node?.id || "Node";
  const content =
    node?.content?.trim() ||
    (node ? `No content woven for “${title}” yet.` : "");
  const confidenceLabel = formatConfidence(node?.confidence);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[min(85dvh,40rem)] max-w-lg overflow-y-auto border-[var(--border-medium)] bg-[var(--surface-elevated)]/95 backdrop-blur-md"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-terminal)] text-lg tracking-widest text-primary uppercase">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Memory node
          </DialogDescription>
        </DialogHeader>

        {node && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
              <div className="mb-1.5 text-[0.7rem] tracking-wider text-text-secondary uppercase">
                Content
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-text-primary">
                {content}
              </p>
            </div>

            {node.impression?.trim() ? (
              <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
                <div className="mb-1.5 text-[0.7rem] tracking-wider text-text-secondary uppercase">
                  Impression
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-text-primary">
                  {node.impression.trim()}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {confidenceLabel ? (
                <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 px-3 py-2">
                  <div className="mb-0.5 text-[0.65rem] tracking-wider text-text-secondary uppercase">
                    Confidence
                  </div>
                  <div className="font-mono text-primary">{confidenceLabel}</div>
                </div>
              ) : null}
              <div className="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 px-3 py-2">
                <div className="mb-0.5 text-[0.65rem] tracking-wider text-text-secondary uppercase">
                  Id
                </div>
                <div className="truncate font-mono text-xs text-text-secondary">
                  {node.id}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
