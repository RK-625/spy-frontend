/**
 * Notes list forest from graph topology.
 * PARENT_OF only (source = parent, target = child). First parent wins.
 * Isolated nodes are roots. Cycles stop at the repeated node; leftover
 * cycle members become extra roots, then the forest is name-sorted.
 */
import type { Links, MemoryNode } from "@/types/graph-schema";

/** Fields the forest reads; any lean or full Memory row satisfies it. */
type NoteIdentity = Pick<MemoryNode, "id" | "name">;

export type NotesForestNode<T extends NoteIdentity = MemoryNode> = {
  note: T;
  children: NotesForestNode<T>[];
};

function compareNoteNames(left: NoteIdentity, right: NoteIdentity): number {
  const leftName = left.name || left.id || "";
  const rightName = right.name || right.id || "";
  return leftName.localeCompare(rightName);
}

export function buildNotesForest<T extends NoteIdentity>(
  notes: readonly T[],
  links: readonly Links[],
): NotesForestNode<T>[] {
  const byId = new Map<string, T>();
  for (const note of notes) {
    byId.set(note.id, note);
  }

  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();

  for (const link of links) {
    if (link.type !== "PARENT_OF") continue;
    if (!byId.has(link.source) || !byId.has(link.target)) continue;
    if (parentOf.has(link.target)) continue;
    parentOf.set(link.target, link.source);
    const siblings = childrenOf.get(link.source);
    if (siblings) {
      siblings.push(link.target);
    } else {
      childrenOf.set(link.source, [link.target]);
    }
  }

  const sortIds = (ids: readonly string[]): string[] =>
    [...ids].sort((leftId, rightId) =>
      compareNoteNames(byId.get(leftId)!, byId.get(rightId)!),
    );

  const visiting = new Set<string>();
  const built = new Set<string>();

  const buildBranch = (id: string): NotesForestNode<T> | null => {
    const note = byId.get(id);
    if (!note) return null;
    if (visiting.has(id) || built.has(id)) return null;
    visiting.add(id);
    const childIds = sortIds(childrenOf.get(id) ?? []);
    const children: NotesForestNode<T>[] = [];
    for (const childId of childIds) {
      const child = buildBranch(childId);
      if (child) children.push(child);
    }
    visiting.delete(id);
    built.add(id);
    return { note, children };
  };

  const forest: NotesForestNode<T>[] = [];
  for (const id of sortIds(
    notes.filter((note) => !parentOf.has(note.id)).map((note) => note.id),
  )) {
    const node = buildBranch(id);
    if (node) forest.push(node);
  }
  // fallback here for the cyclical dependency
  for (const id of sortIds(
    notes.filter((note) => !built.has(note.id)).map((note) => note.id),
  )) {
    const node = buildBranch(id);
    if (node) forest.push(node);
  }

  forest.sort((left, right) => compareNoteNames(left.note, right.note));
  return forest;
}

/** One family per note; parent pointers come from the rendered forest. */
export type NotesFamily = {
  node: NotesForestNode;
  parentId: string | null;
};

export function indexNotesFamilies(
  forest: readonly NotesForestNode[],
): Map<string, NotesFamily> {
  const families = new Map<string, NotesFamily>();
  const pending: NotesFamily[] = forest.map((node) => ({
    node,
    parentId: null,
  }));
  while (pending.length > 0) {
    const family = pending.pop()!;
    families.set(family.node.note.id, family);
    for (const child of family.node.children) {
      pending.push({ node: child, parentId: family.node.note.id });
    }
  }
  return families;
}

/** Ancestors and current note from the normalized, sidebar-visible hierarchy. */
export function getNotePath(
  families: ReadonlyMap<string, NotesFamily>,
  noteId: string,
): MemoryNode[] {
  const path: MemoryNode[] = [];
  let family = families.get(noteId);
  while (family) {
    path.push(family.node.note);
    family =
      family.parentId === null ? undefined : families.get(family.parentId);
  }
  return path.reverse();
}

export function getNoteTitle(note: MemoryNode): string {
  return note.name?.trim() || note.id || "Note";
}
