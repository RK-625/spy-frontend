"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useIsPresent } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";
import { ChatSidebarNotesRow } from "./notes-row";
import type { NotesFamily, NotesForestNode } from "@/lib/notes/hierarchy";

export function ChatSidebarNotesFamily({
  family,
  parentTitle,
  nodes,
  selectedNoteId,
  scrollPositions,
  focusHeading,
  onOpenNote,
  onBrowseFamily,
}: {
  family: NotesFamily | null;
  parentTitle: string;
  nodes: readonly NotesForestNode[];
  selectedNoteId: string | null;
  scrollPositions: RefObject<Map<string | null, number>>;
  focusHeading: boolean;
  onOpenNote: (noteId: string) => void;
  onBrowseFamily: (noteId: string | null, direction: 1 | -1) => void;
}) {
  const familyPresent = useIsPresent();
  const [previewNoteId, setPreviewNoteId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(focusHeading);
  const familyId = family?.node.note.id ?? null;
  // A family mounts only on a sidebar navigation, not on a note selection.
  useLayoutEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = scrollPositions.current.get(familyId) ?? 0;
    }
    if (restoreFocus.current) headingRef.current?.focus({ preventScroll: true });
  }, [familyId, scrollPositions]);

  const familyTitle = family?.node.note.name?.trim() || family?.node.note.id;
  return (
    <div className="flex h-full min-h-0 flex-col" inert={!familyPresent} aria-hidden={!familyPresent}>
      {family ? (
        <div className="flex shrink-0 flex-col gap-1 px-3 pb-2">
          <button
            type="button"
            title={`Back to ${parentTitle}`}
            aria-label={`Back to ${parentTitle}`}
            onClick={() => onBrowseFamily(family.parentId, -1)}
            className="flex min-h-8 min-w-0 items-center gap-2 rounded-[var(--radius)] px-2 text-left text-[0.8125rem] text-text-secondary transition-colors hover:bg-[var(--surface-hover)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={ICON_GLYPH.inline} className="shrink-0" aria-hidden />
            <span className="truncate">{parentTitle}</span>
          </button>
          <button
            ref={(element) => {
              headingRef.current = element;
            }}
            type="button"
            title={familyTitle}
            aria-current={selectedNoteId === family.node.note.id ? "page" : undefined}
            onClick={() => onOpenNote(family.node.note.id)}
            className={cn(
              "min-w-0 rounded-[var(--radius)] px-2 py-1.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedNoteId === family.node.note.id && "bg-[var(--surface-focus)]",
            )}
          >
            <span className="block truncate">{familyTitle}</span>
          </button>
        </div>
      ) : (
        <h2
          ref={(element) => {
            headingRef.current = element;
          }}
          tabIndex={-1}
          className="mx-3 mb-2 rounded-[var(--radius)] px-2 py-1.5 text-left text-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          All topics
        </h2>
      )}
      {nodes.length > 0 ? (
        <ul
          ref={listRef}
          aria-label={familyTitle ? `Children of ${familyTitle}` : "All topics"}
          onScroll={(event) => {
            setPreviewNoteId(null);
            scrollPositions.current.set(familyId, event.currentTarget.scrollTop);
          }}
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2"
        >
          {nodes.map((node) => (
            <ChatSidebarNotesRow
              key={node.note.id}
              title={node.note.name?.trim() || node.note.id}
              childNotes={node.children}
              noteSelected={node.note.id === selectedNoteId}
              selectedNoteId={selectedNoteId}
              previewEnabled={familyPresent}
              previewOpen={previewNoteId === node.note.id}
              onPreviewChange={(open) => setPreviewNoteId((current) =>
                open ? node.note.id : current === node.note.id ? null : current,
              )}
              onOpenNote={() => onOpenNote(node.note.id)}
              onOpenChildNote={onOpenNote}
              onBrowseChildren={() => onBrowseFamily(node.note.id, 1)}
            />
          ))}
        </ul>
      ) : (
        <p className="px-5 text-sm text-text-secondary">No child notes</p>
      )}
    </div>
  );
}
