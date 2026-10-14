"use client";

import { useRef, useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  size,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
  useTransitionStatus,
} from "@floating-ui/react";
import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { MOTION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { NotesForestNode } from "@/lib/notes/hierarchy";

const CHILD_PREVIEW_DELAY = { open: 500, close: 150 };
const CHILD_PREVIEW_PADDING = 8;

export function ChatSidebarNotesRow({
  title,
  childNotes,
  noteSelected,
  selectedNoteId,
  previewOpen,
  previewEnabled,
  onPreviewChange,
  onOpenNote,
  onOpenChildNote,
  onBrowseChildren,
}: {
  title: string;
  childNotes: readonly NotesForestNode[];
  noteSelected: boolean;
  selectedNoteId: string | null;
  previewOpen: boolean;
  previewEnabled: boolean;
  onPreviewChange: (open: boolean) => void;
  onOpenNote: () => void;
  onOpenChildNote: (noteId: string) => void;
  onBrowseChildren: () => void;
}) {
  const hasChildren = childNotes.length > 0;
  const childPreviewOpen = previewOpen && previewEnabled && hasChildren;
  const [keyboardPreview, setKeyboardPreview] = useState(false);
  const noteButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? { duration: 0 } : MOTION.chrome;
  const { refs: { setReference, setFloating }, floatingStyles, context } = useFloating({
    open: childPreviewOpen,
    onOpenChange: (open, event) => {
      if (open) setKeyboardPreview(event?.type === "keydown");
      onPreviewChange(open);
    },
    placement: "right-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      // Vertical overflow shifts the menu up; only horizontal overflow flips it.
      flip({ padding: CHILD_PREVIEW_PADDING, crossAxis: false, fallbackAxisSideDirection: "end" }),
      shift({ padding: CHILD_PREVIEW_PADDING }),
      size({
        padding: CHILD_PREVIEW_PADDING,
        apply({ availableWidth, availableHeight, elements }) {
          elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
        },
      }),
    ],
  });
  const hover = useHover(context, {
    enabled: previewEnabled && hasChildren,
    mouseOnly: true,
    delay: CHILD_PREVIEW_DELAY,
    move: false,
    handleClose: safePolygon(),
  });
  const dismiss = useDismiss(context, { ancestorScroll: true });
  const role = useRole(context, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);
  const { isMounted } = useTransitionStatus(context, { duration: transition.duration * 1000 });

  function handlePreviewKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPreviewChange(false);
      noteButtonRef.current?.focus();
    }
  }

  function closePreview() {
    onPreviewChange(false);
  }

  return (
    <li
      ref={setReference}
      {...getReferenceProps({
        onPointerEnter: () => {
          if (!hasChildren) closePreview();
        },
        onKeyDown: (event) => {
          if (event.key === "ArrowRight" && hasChildren && previewEnabled) {
            event.preventDefault();
            setKeyboardPreview(true);
            onPreviewChange(true);
          }
        },
      })}
      className={cn(
        "group flex w-full min-w-0 items-center rounded-[var(--radius)] text-[0.8125rem] transition-colors",
        noteSelected || childPreviewOpen
          ? "bg-[var(--surface-focus)] text-text-primary"
          : "text-text-primary hover:bg-[var(--surface-hover)]",
      )}
    >
      <button
        ref={noteButtonRef}
        type="button"
        onClick={() => {
          closePreview();
          onOpenNote();
        }}
        title={hasChildren ? undefined : title}
        aria-current={noteSelected ? "page" : undefined}
        aria-expanded={hasChildren ? childPreviewOpen : undefined}
        aria-haspopup={hasChildren ? "dialog" : undefined}
        className="min-w-0 flex-1 rounded-[var(--radius)] px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block truncate">{title}</span>
      </button>
      {hasChildren ? (
        <button
          type="button"
          aria-label={`Browse ${title}’s children`}
          onClick={() => {
            closePreview();
            onBrowseChildren();
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] text-primary transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight size={ICON_GLYPH.inline} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      {isMounted ? (
        <FloatingPortal>
          <FloatingFocusManager
            context={context}
            modal={false}
            disabled={!childPreviewOpen}
            initialFocus={keyboardPreview ? 0 : -1}
            returnFocus={keyboardPreview ? noteButtonRef : false}
          >
            <div
              ref={setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              aria-label={`Children of ${title}`}
              onKeyDownCapture={handlePreviewKeyDown}
              className="notes-children-flyout"
              inert={!childPreviewOpen}
            >
              <motion.ul
                initial={{ opacity: 0, scale: 0.98 }}
                animate={childPreviewOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
                transition={transition}
                aria-label={`Child notes of ${title}`}
                className="flex min-w-0 flex-col gap-0.5 p-1"
              >
                {childNotes.map(({ note }) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      title={note.name?.trim() || note.id}
                      aria-current={note.id === selectedNoteId ? "page" : undefined}
                      onClick={() => {
                        closePreview();
                        onOpenChildNote(note.id);
                      }}
                      className="notes-children-flyout-item"
                    >
                      <span className="min-w-0 wrap-break-word">{note.name?.trim() || note.id}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      ) : null}
    </li>
  );
}
