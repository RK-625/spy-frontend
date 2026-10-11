"use client";

import { ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";

export function ChatSidebarNotesRow({
  title,
  hasChildren,
  noteSelected,
  onOpenNote,
  onBrowseChildren,
}: {
  title: string;
  hasChildren: boolean;
  noteSelected: boolean;
  onOpenNote: () => void;
  onBrowseChildren: () => void;
}) {
  return (
    <li
      className={cn(
        "group flex w-full min-w-0 items-center rounded-[var(--radius)] text-[0.8125rem] transition-colors",
        noteSelected
          ? "bg-[var(--surface-focus)] text-text-primary"
          : "text-text-primary hover:bg-[var(--surface-hover)]",
      )}
    >
      <button
        type="button"
        onClick={onOpenNote}
        title={title}
        aria-current={noteSelected ? "page" : undefined}
        className="min-w-0 flex-1 rounded-[var(--radius)] px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block truncate">{title}</span>
      </button>
      {hasChildren ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Browse ${title}’s children`}
              onClick={onBrowseChildren}
              className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] text-primary transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight size={ICON_GLYPH.inline} strokeWidth={2} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Browse {title}’s children</TooltipContent>
        </Tooltip>
      ) : null}
    </li>
  );
}
