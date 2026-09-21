"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { MilkdownView } from "@/components/graph/editor/milkdown-view";
import { Button } from "@/components/ui";
import type { MemoryNode } from "@/types/graph-schema";

export type NoteWorkspaceProps = {
  children: ReactNode;
};

function formatConfidence(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return `${pct}%`;
}

/**
 * Full-bleed note chrome at `/notes/[id]`.
 * Always on (X / Escape → `/notes`). Body is passed as children.
 */
export function NoteWorkspace({ children }: NoteWorkspaceProps) {
  const router = useRouter();
  const handleDismissNote = useCallback(() => {
    router.push("/notes");
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        handleDismissNote();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDismissNote]);

  return (
    <div
      role="region"
      aria-label="Note"
      className="relative flex h-full w-full flex-col overflow-hidden bg-surface-chat px-12 py-8 animate-in fade-in duration-200"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleDismissNote}
        aria-label="Close note"
        className="absolute top-8 right-12 z-10"
      >
        <X size={16} strokeWidth={1.5} />
      </Button>
      <div className="flex min-h-0 flex-1 flex-col pr-10">{children}</div>
    </div>
  );
}

/** Ready document: title, read-only Milkdown, impression. */
export function NoteReadyBody({ node }: { node: MemoryNode }) {
  const title = node.name?.trim() || node.id || "Note";
  const confidenceLabel = formatConfidence(node.confidence);
  const documentText =
    node.content?.trim() || `No content woven for “${title}” yet.`;
  const impression = node.impression?.trim();

  return (
    <>
      <header className="flex shrink-0 items-center gap-3">
        <h1 className="truncate font-sans text-[1.75rem] font-semibold tracking-wide text-text-primary uppercase">
          {title}
        </h1>
        {confidenceLabel ? (
          <span className="shrink-0 font-mono text-sm text-text-secondary">
            {confidenceLabel}
          </span>
        ) : null}
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
    </>
  );
}
