"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GraphNode } from "@/lib/graph";

export type NodeDetail = Pick<
  GraphNode,
  | "id"
  | "label"
  | "content"
  | "impression"
  | "confidence"
  | "rank"
  | "childIds"
  | "parentIds"
  | "relateIds"
>;

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
  node: NodeDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const title = node?.label?.trim() || node?.id || "Node";
  const content =
    node?.content?.trim() ||
    (node
      ? `No content woven for “${title}” yet.`
      : "");
  const confidenceLabel = formatConfidence(node?.confidence);
  const childCount = node?.childIds?.length ?? 0;
  const parentCount = node?.parentIds?.length ?? 0;
  const relateCount = node?.relateIds?.length ?? 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[min(85dvh,40rem)] max-w-lg overflow-y-auto border-[var(--border-medium)] bg-[var(--surface-elevated)]/95 backdrop-blur-md"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-terminal)] text-lg tracking-widest text-[#e8dff8] uppercase">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#7a7685]">
            {node ? (
              <>
                Rank {node.rank}
                <span className="mx-1.5 text-[#4a4658]">·</span>
                {parentCount} parent{parentCount === 1 ? "" : "s"}
                <span className="mx-1.5 text-[#4a4658]">·</span>
                {childCount} child{childCount === 1 ? "" : "ren"}
                <span className="mx-1.5 text-[#4a4658]">·</span>
                {relateCount} relate{relateCount === 1 ? "" : "s"}
              </>
            ) : (
              "Memory node"
            )}
          </DialogDescription>
        </DialogHeader>

        {node && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
              <div className="mb-1.5 text-[0.7rem] tracking-wider text-[#7a7685] uppercase">
                Content
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-[#ded4f0]">
                {content}
              </p>
            </div>

            {node.impression?.trim() ? (
              <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
                <div className="mb-1.5 text-[0.7rem] tracking-wider text-[#7a7685] uppercase">
                  Impression
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-[#e8e4df]">
                  {node.impression.trim()}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {confidenceLabel ? (
                <div className="rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 px-3 py-2">
                  <div className="mb-0.5 text-[0.65rem] tracking-wider text-[#7a7685] uppercase">
                    Confidence
                  </div>
                  <div className="font-mono text-[#e8dff8]">{confidenceLabel}</div>
                </div>
              ) : null}
              <div className="min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 px-3 py-2">
                <div className="mb-0.5 text-[0.65rem] tracking-wider text-[#7a7685] uppercase">
                  Id
                </div>
                <div className="truncate font-mono text-xs text-[#7a7685]">
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
