"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useChatContext } from "@/contexts/ChatContext";
import type { GraphApiResponse } from "@/types/graph-topology";
import type { MemoryNode } from "@/types/graph-schema";
import { ChatSidebarNotesRow } from "./notes-row";
import {
  buildNotesForest,
  rootExpandedNoteIds,
  type NotesForestNode,
} from "./notes-forest";

const EXPANDED_NOTES_STORAGE_KEY = "spy-notes";

function ChatSidebarNotesRule() {
  return <div className="h-px flex-1 bg-[var(--accent-border)]" />;
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
}: {
  node: NotesForestNode;
  depth: number;
  expandedNoteIds: ReadonlySet<string>;
  selectedNoteId: string | null;
  onSelectNote: (note: MemoryNode) => void;
  onFolderExpandedChange: (noteId: string, expanded: boolean) => void;
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
        onOpenNote={() => onSelectNote(node.note)}
        onFolderExpandedChange={(expanded) =>
          onFolderExpandedChange(node.note.id, expanded)
        }
      />
      {hasChildren && folderExpanded
        ? node.children.map((child) => (
            <ChatSidebarNotesBranch
              key={child.note.id}
              node={child}
              depth={depth + 1}
              expandedNoteIds={expandedNoteIds}
              selectedNoteId={selectedNoteId}
              onSelectNote={onSelectNote}
              onFolderExpandedChange={onFolderExpandedChange}
            />
          ))
        : null}
    </div>
  );
}

export function ChatSidebarNotes() {
  const { status, chatOrder, selectedNote, setSelectedNote } = useChatContext();
  const streamReady = status === "ready";
  const [forest, setForest] = useState<NotesForestNode[]>([]);
  const [notesLoadState, setNotesLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(
    () => new Set(),
  );
  const expandedHydratedRef = useRef(false);

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
            selectedNoteId={selectedNote?.id ?? null}
            onSelectNote={setSelectedNote}
            onFolderExpandedChange={handleFolderExpandedChange}
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
