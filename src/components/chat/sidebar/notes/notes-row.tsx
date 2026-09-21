"use client";

import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";

const NOTE_TREE_INDENT_PX = 10;

export function ChatSidebarNotesRow({
  title,
  depth,
  hasChildren,
  folderExpanded,
  noteSelected,
  onOpenNote,
  onFolderExpandedChange,
  chromeTransition,
}: {
  title: string;
  depth: number;
  hasChildren: boolean;
  folderExpanded: boolean;
  noteSelected: boolean;
  onOpenNote: () => void;
  onFolderExpandedChange: (expanded: boolean) => void;
  chromeTransition: { duration: number; ease?: "easeOut" };
}) {
  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={noteSelected}
      aria-expanded={hasChildren ? folderExpanded : undefined}
      className={cn(
        "group relative flex w-full items-center rounded-[var(--radius)] text-[0.8125rem] transition-colors",
        noteSelected
          ? "bg-[var(--surface-focus)] text-text-primary"
          : "text-text-primary hover:bg-[var(--surface-hover)]",
      )}
    >
      <div
        className="flex w-full min-w-0 items-center"
        style={{ paddingLeft: depth * NOTE_TREE_INDENT_PX }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={
              folderExpanded ? `Collapse ${title}` : `Expand ${title}`
            }
            onClick={(event) => {
              event.stopPropagation();
              onFolderExpandedChange(!folderExpanded);
            }}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-[var(--radius)] outline-none",
              "text-text-secondary hover:text-text-primary",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <motion.span
              className="inline-flex origin-center"
              initial={false}
              animate={{ rotate: folderExpanded ? 90 : 0 }}
              transition={chromeTransition}
            >
              <ChevronRight size={ICON_GLYPH.badge} strokeWidth={1.5} />
            </motion.span>
          </button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={onOpenNote}
          title={title}
          className={cn(
            "min-w-0 flex-1 rounded-[var(--radius)] py-1.5 pr-2 text-left outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          <span className="block min-w-0 truncate">{title}</span>
        </button>
      </div>
    </div>
  );
}
