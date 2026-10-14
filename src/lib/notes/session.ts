import { DirectedGraph } from "graphology";
import { bfsFromNode } from "graphology-traversal/bfs";
import type { MemoryNode } from "@/types/graph-schema";
import {
  getNotePath,
  type NotesFamily,
  type NotesForestNode,
} from "./hierarchy";

export type NoteLearningOutcome = "reviewed" | "skipped";

export type NoteLearningSnapshot = {
  rootId: string;
  cardIds: string[];
  notes: Map<string, MemoryNode>;
  hierarchy: NotesForestNode;
  paths: Map<string, MemoryNode[]>;
  groupIds: Set<string>;
};

/** Copy once at session start so subsequent topology changes cannot edit a session. */
export function createNoteLearningSnapshot(
  families: ReadonlyMap<string, NotesFamily>,
  rootId: string,
): NoteLearningSnapshot | null {
  const root = families.get(rootId);
  if (!root) return null;
  const hierarchy = structuredClone(root.node);
  const ancestors = structuredClone(getNotePath(families, rootId).slice(0, -1));
  const graph = new DirectedGraph<{ noteId: string }>();
  const notes = new Map<string, MemoryNode>();
  const paths = new Map<string, MemoryNode[]>();
  const groupIds = new Set<string>();

  const addBranch = (branch: NotesForestNode, parents: MemoryNode[]) => {
    const { note, children } = branch;
    // Prefix keys to preserve name-sorted insertion order for numeric note IDs, too.
    const key = `note:${note.id}`;
    graph.addNode(key, { noteId: note.id });
    notes.set(note.id, note);
    const path = [...parents, note];
    paths.set(note.id, path);
    if (children.length) groupIds.add(note.id);
    for (const child of children) {
      addBranch(child, path);
      graph.addDirectedEdge(key, `note:${child.note.id}`);
    }
  };
  addBranch(hierarchy, ancestors);
  const cardIds: string[] = [];
  bfsFromNode(
    graph,
    `note:${rootId}`,
    (_key, attributes) => {
      cardIds.push(attributes.noteId);
    },
    { mode: "outbound" },
  );
  return { rootId, cardIds, notes, hierarchy, paths, groupIds };
}

export type NoteLearningSession = {
  snapshot: NoteLearningSnapshot;
  mode: "active" | "completed" | "revisit";
  currentIndex: number;
  outcomes: Map<string, NoteLearningOutcome>;
  expandedGroupIds: Set<string>;
  revisitedNoteId: string | null;
  direction: 1 | -1;
};

export type NoteLearningAction =
  | { type: "start"; snapshot: NoteLearningSnapshot }
  | { type: "exit" }
  | { type: "previous" }
  | { type: "decide"; outcome: NoteLearningOutcome }
  | { type: "revisit"; noteId: string }
  | { type: "summary" }
  | { type: "expand"; noteId: string; expanded: boolean };

/** Local state only: no storage, confidence writes, or graph mutations. */
export function noteLearningReducer(
  session: NoteLearningSession | null,
  action: NoteLearningAction,
): NoteLearningSession | null {
  if (action.type === "exit") return null;
  if (action.type === "start") {
    return {
      snapshot: action.snapshot,
      mode: "active",
      currentIndex: 0,
      outcomes: new Map(),
      expandedGroupIds: new Set(action.snapshot.groupIds),
      revisitedNoteId: null,
      direction: 1,
    };
  }
  if (!session) return session;
  switch (action.type) {
    case "previous":
      return session.mode === "active" && session.currentIndex > 0
        ? { ...session, currentIndex: session.currentIndex - 1, direction: -1 }
        : session;
    case "decide": {
      if (session.mode !== "active") return session;
      const outcomes = new Map(session.outcomes);
      outcomes.set(
        session.snapshot.cardIds[session.currentIndex],
        action.outcome,
      );
      const finalCard =
        session.currentIndex === session.snapshot.cardIds.length - 1;
      return {
        ...session,
        outcomes,
        mode: finalCard ? "completed" : "active",
        currentIndex: finalCard
          ? session.currentIndex
          : session.currentIndex + 1,
        direction: 1,
      };
    }
    case "revisit":
      return session.mode === "completed" &&
        session.snapshot.notes.has(action.noteId)
        ? {
            ...session,
            mode: "revisit",
            revisitedNoteId: action.noteId,
            direction: 1,
          }
        : session;
    case "summary":
      return session.mode === "revisit"
        ? {
            ...session,
            mode: "completed",
            revisitedNoteId: null,
            direction: -1,
          }
        : session;
    case "expand": {
      if (
        session.mode !== "completed" ||
        !session.snapshot.groupIds.has(action.noteId)
      )
        return session;
      const expandedGroupIds = new Set(session.expandedGroupIds);
      if (action.expanded) expandedGroupIds.add(action.noteId);
      else expandedGroupIds.delete(action.noteId);
      return { ...session, expandedGroupIds };
    }
  }
}

export function getNoteLearningCounts(session: NoteLearningSession) {
  let reviewed = 0;
  let skipped = 0;
  for (const outcome of session.outcomes.values()) {
    if (outcome === "reviewed") reviewed++;
    else skipped++;
  }
  return {
    reviewed,
    skipped,
    processed: reviewed + skipped,
    total: session.snapshot.cardIds.length,
  };
}
