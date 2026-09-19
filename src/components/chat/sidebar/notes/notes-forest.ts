/**
 * Notes list forest from graph topology.
 * PARENT_OF only (source = parent, target = child). First parent wins.
 * Isolated nodes are roots. Cycles stop at the repeated node; leftover
 * cycle members become extra roots, then the forest is name-sorted.
 */
import type { Links, MemoryNode } from "@/types/graph-schema";

export type NotesForestNode = {
  note: MemoryNode;
  children: NotesForestNode[];
};

function compareNoteNames(
  left: MemoryNode,
  right: MemoryNode ,
): number {
  const leftName = left.name || left.id || "";
  const rightName = right.name || right.id || "";
  return leftName.localeCompare(rightName);
}

export function buildNotesForest(
  notes: readonly MemoryNode[],
  links: readonly Links[],
): NotesForestNode[] {
  const byId = new Map<string, MemoryNode>();
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

  const buildBranch = (id: string): NotesForestNode | null => {
    const note = byId.get(id);
    if (!note) return null;
    if (visiting.has(id) || built.has(id)) return null;
    visiting.add(id);
    const childIds = sortIds(childrenOf.get(id) ?? []);
    const children: NotesForestNode[] = [];
    for (const childId of childIds) {
      const child = buildBranch(childId);
      if (child) children.push(child);
    }
    visiting.delete(id);
    built.add(id);
    return { note, children };
  };

  const forest: NotesForestNode[] = [];
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

  forest.sort((left, right) =>
    compareNoteNames(left.note, right.note),
  );
  return forest;
}

/** Root folders (nodes with children) — default expanded set. */
export function rootExpandedNoteIds(
  forest: readonly NotesForestNode[],
): string[] {
  return forest
    .filter((node) => node.children.length > 0)
    .map((node) => node.note.id);
}
