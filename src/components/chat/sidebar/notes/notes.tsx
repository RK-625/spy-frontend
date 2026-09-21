"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { Separator } from "@/components/ui";
import { useChatContext } from "@/contexts/ChatContext";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import type { GraphApiResponse } from "@/types/graph-topology";
import { ChatSidebarNotesRow } from "./notes-row";
import {
  buildNotesForest,
  rootExpandedNoteIds,
  type NotesForestNode,
} from "./notes-forest";

const EXPANDED_NOTES_STORAGE_KEY = "spy-notes";

function ChatSidebarNotesRule() {
  return (
    <Separator className="h-px w-auto flex-1 bg-[var(--accent-border)]" />
  );
}

function readStoredExpandedNoteIds(): string[] | null {
  try {
    const raw = localStorage.getItem(EXPANDED_NOTES_STORAGE_KEY);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.some((id) => typeof id !== "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function ChatSidebarNotesBranch({
  node,
  depth,
  expandedNoteIds,
  selectedNoteId,
  onSelectNote,
  onFolderExpandedChange,
  chromeTransition,
}: {
  node: NotesForestNode;
  depth: number;
  expandedNoteIds: ReadonlySet<string>;
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onFolderExpandedChange: (noteId: string, expanded: boolean) => void;
  chromeTransition: { duration: number; ease?: "easeOut" };
}) {
  const hasChildren = node.children.length > 0;
  const folderExpanded = expandedNoteIds.has(node.note.id);

  return (
    <div>
      <ChatSidebarNotesRow
        title={node.note.name?.trim() || node.note.id}
        depth={depth}
        hasChildren={hasChildren}
        folderExpanded={folderExpanded}
        noteSelected={node.note.id === selectedNoteId}
        onOpenNote={() => onSelectNote(node.note.id)}
        onFolderExpandedChange={(expanded) =>
          onFolderExpandedChange(node.note.id, expanded)
        }
        chromeTransition={chromeTransition}
      />
      <AnimatePresence initial={false}>
        {hasChildren && folderExpanded ? (
          <motion.div
            key={`${node.note.id}-children`}
            className="overflow-hidden"
            initial={{ ...CHROME_FADE.initial, height: 0 }}
            animate={{ ...CHROME_FADE.animate, height: "auto" }}
            exit={{ ...CHROME_FADE.exit, height: 0 }}
            transition={chromeTransition}
          >
            {node.children.map((child) => (
              <ChatSidebarNotesBranch
                key={child.note.id}
                node={child}
                depth={depth + 1}
                expandedNoteIds={expandedNoteIds}
                selectedNoteId={selectedNoteId}
                onSelectNote={onSelectNote}
                onFolderExpandedChange={onFolderExpandedChange}
                chromeTransition={chromeTransition}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function noteIdFromParams(id: string | string[] | undefined): string | null {
  if (typeof id !== "string" || id.length === 0) return null;
  return id;
}

export function ChatSidebarNotes() {
  const { status, chatOrder } = useChatContext();
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const selectedNoteId = noteIdFromParams(params.id);
  const streamReady = status === "ready";
  const [forest, setForest] = useState<NotesForestNode[]>([]);
  const [notesLoadState, setNotesLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(
    () => new Set(),
  );
  const expandedHydratedRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const chromeTransition = reducedMotion ? { duration: 0 } : MOTION.chrome;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/graph")
      .then(async (res) => {
        const data = (await res.json()) as GraphApiResponse;
        if (cancelled) return;
        if (!data.ok) {
          setForest([]);
          setNotesLoadState("error");
          return;
        }
        const nextForest = buildNotesForest(data.memories, data.links);
        setForest(nextForest);
        if (!expandedHydratedRef.current) {
          const stored = readStoredExpandedNoteIds();
          setExpandedNoteIds(
            new Set(stored ?? rootExpandedNoteIds(nextForest)),
          );
          expandedHydratedRef.current = true;
        }
        setNotesLoadState("ready");
      })
      .catch((err: unknown) => {
        console.error("notes graph:", err);
        if (!cancelled) {
          setForest([]);
          setNotesLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [streamReady, chatOrder]);

  useEffect(() => {
    if (notesLoadState !== "ready") return;
    try {
      localStorage.setItem(
        EXPANDED_NOTES_STORAGE_KEY,
        JSON.stringify([...expandedNoteIds]),
      );
    } catch {
      // localStorage unavailable
    }
  }, [expandedNoteIds, notesLoadState]);

  const handleFolderExpandedChange = useCallback(
    (noteId: string, expanded: boolean) => {
      setExpandedNoteIds((prev) => {
        const next = new Set(prev);
        if (expanded) next.add(noteId);
        else next.delete(noteId);
        return next;
      });
    },
    [],
  );

  const handleSelectNote = useCallback(
    (noteId: string) => {
      router.push(`/notes/${encodeURIComponent(noteId)}`);
    },
    [router],
  );

  let body: ReactNode;
  if (notesLoadState === "loading") {
    body = (
      <div className="flex flex-1 items-center justify-center px-3">
        <span className="text-sm text-text-secondary">Loading notes…</span>
      </div>
    );
  } else if (notesLoadState === "error") {
    body = (
      <div className="flex flex-1 items-center justify-center px-3">
        <span className="text-sm text-text-secondary">
          Couldn&apos;t load notes
        </span>
      </div>
    );
  } else if (forest.length === 0) {
    body = (
      <div className="flex flex-1 items-center justify-center px-3">
        <span className="text-center text-sm text-text-secondary">
          No notes yet. Spy weaves them as they land in the graph.
        </span>
      </div>
    );
  } else {
    body = (
      <div
        role="tree"
        aria-label="Notes"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2"
      >
        {forest.map((node) => (
          <ChatSidebarNotesBranch
            key={node.note.id}
            node={node}
            depth={0}
            expandedNoteIds={expandedNoteIds}
            selectedNoteId={selectedNoteId}
            onSelectNote={handleSelectNote}
            onFolderExpandedChange={handleFolderExpandedChange}
            chromeTransition={chromeTransition}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="font-[family-name:var(--font-terminal)] text-[0.8125rem] font-medium uppercase tracking-[0.2em] text-text-secondary">
          Notes
        </span>
        <ChatSidebarNotesRule />
      </div>
      {body}
    </div>
  );
}
