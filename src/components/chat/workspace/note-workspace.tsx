"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { MilkdownView } from "@/components/graph/editor/milkdown-view";
import { Button } from "@/components/ui";
import type { MemoryNode } from "@/types/graph-schema";

export interface NoteWorkspaceProps {
  node: MemoryNode;
  onClose: () => void;
}

function formatConfidence(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return `${pct}%`;
}

/**
 * Full-bleed Note Workspace in the chat column.
 * Renders note markdown in read-only MilkdownView with header controls and impression footer.
 */
export function NoteWorkspace({ node, onClose }: NoteWorkspaceProps) {
  const title = node.name?.trim() || node.id || "Note";
  const confidenceLabel = formatConfidence(node.confidence);
  const documentText =
    node.content?.trim() || `No content woven for “${title}” yet.`;
  const impression = node.impression?.trim();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="region"
      aria-label={`Note: ${title}`}
      className="flex h-full w-full flex-col overflow-hidden bg-surface-chat px-12 py-8 animate-in fade-in duration-200"
    >
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate font-sans text-[1.75rem] font-semibold tracking-wide text-text-primary uppercase">
            {title}
          </h1>
          {confidenceLabel ? (
            <span className="shrink-0 font-mono text-sm text-text-secondary">
              {confidenceLabel}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close note"
        >
          <X size={16} strokeWidth={1.5} />
        </Button>
      </header>

      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/30 p-4">
        <MilkdownView
          key={node.id}
          documentText={documentText}
          readOnly={true}
        />
      </div>

      {impression ? (
        <div className="mt-4 shrink-0 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/30 p-3">
          <div className="text-[0.7rem] font-medium tracking-wider text-text-secondary uppercase">
            IMPRESSION
          </div>
          <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {impression}
          </p>
        </div>
      ) : null}
    </div>
  );
}
