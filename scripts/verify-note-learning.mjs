/** Pure fixture verification; never opens or writes the live graph. */
import assert from "node:assert/strict";
import {
  buildNotesForest,
  indexNotesFamilies,
  getNotePath,
} from "../src/lib/notes/hierarchy.ts";
import {
  createNoteLearningSnapshot,
  noteLearningReducer,
  getNoteLearningCounts,
} from "../src/lib/notes/session.ts";

const note = (id, name = id) => ({
  id,
  name,
  content: `Content ${id}`,
  impression: `Impression ${id}`,
  confidence: 0.25,
});
const parent = (source, target) => ({ source, target, type: "PARENT_OF" });
const notes = [
  note("root"),
  note("10", "A"),
  note("2", "B"),
  note("grandchild"),
  note("other"),
  note("leaf"),
  note("__proto__"),
];
const links = [
  parent("root", "2"),
  parent("root", "10"),
  parent("10", "grandchild"),
  parent("root", "10"),
  parent("other", "10"),
  parent("missing", "leaf"),
  { source: "root", target: "other", type: "RELATES_TO" },
];
const families = indexNotesFamilies(buildNotesForest(notes, links));
assert.deepEqual(
  getNotePath(families, "grandchild").map((entry) => entry.id),
  ["root", "10", "grandchild"],
);
const snapshot = createNoteLearningSnapshot(families, "root");
assert.deepEqual(
  snapshot.cardIds,
  ["root", "10", "2", "grandchild"],
  "BFS preserves sorted siblings even for numeric IDs",
);
assert.equal(new Set(snapshot.cardIds).size, 4);
assert.equal(
  snapshot.notes.has("other"),
  false,
  "Associative links and other topics excluded",
);
assert.deepEqual(
  snapshot.hierarchy.children.map((child) => child.note.id),
  ["10", "2"],
);
assert.deepEqual(createNoteLearningSnapshot(families, "10").cardIds, [
  "10",
  "grandchild",
]);
assert.deepEqual(
  createNoteLearningSnapshot(families, "10")
    .paths.get("grandchild")
    .map((entry) => entry.id),
  ["root", "10", "grandchild"],
);
assert.equal(createNoteLearningSnapshot(families, "missing"), null);
assert.deepEqual(createNoteLearningSnapshot(families, "__proto__").cardIds, [
  "__proto__",
]);
let session = noteLearningReducer(null, { type: "start", snapshot });
assert.equal(
  session.outcomes.size,
  0,
  "Opening a card never marks it reviewed",
);
assert.equal(
  noteLearningReducer(session, { type: "previous" }),
  session,
  "Previous disabled at first card",
);
session = noteLearningReducer(session, { type: "decide", outcome: "reviewed" });
assert.equal(session.currentIndex, 1);
session = noteLearningReducer(session, { type: "previous" });
assert.equal(session.outcomes.get("root"), "reviewed");
assert.equal(
  getNoteLearningCounts(session).processed,
  1,
  "Back does not reduce progress",
);
session = noteLearningReducer(session, { type: "decide", outcome: "skipped" });
assert.equal(
  session.outcomes.get("root"),
  "skipped",
  "Explicit action replaces old outcome",
);
assert.equal(
  getNoteLearningCounts(session).processed,
  1,
  "Repeated actions do not inflate counts",
);
session = noteLearningReducer(session, { type: "decide", outcome: "reviewed" });
session = noteLearningReducer(session, { type: "decide", outcome: "skipped" });
session = noteLearningReducer(session, { type: "decide", outcome: "reviewed" });
assert.equal(session.mode, "completed");
assert.deepEqual(getNoteLearningCounts(session), {
  reviewed: 2,
  skipped: 2,
  processed: 4,
  total: 4,
});
assert.equal(
  session.outcomes.get("10"),
  "reviewed",
  "Parent has independent outcome",
);
session = noteLearningReducer(session, {
  type: "expand",
  noteId: "10",
  expanded: false,
});
const outcomesBeforeRevisit = session.outcomes;
session = noteLearningReducer(session, {
  type: "revisit",
  noteId: "grandchild",
});
assert.equal(session.mode, "revisit");
assert.equal(session.revisitedNoteId, "grandchild");
assert.equal(
  noteLearningReducer(session, { type: "decide", outcome: "skipped" }),
  session,
  "Revisit cannot change outcome",
);
session = noteLearningReducer(session, { type: "summary" });
assert.equal(session.mode, "completed");
assert.equal(
  session.expandedGroupIds.has("10"),
  false,
  "Summary expansion survives revisit",
);
assert.equal(session.outcomes, outcomesBeforeRevisit);
assert.equal(
  noteLearningReducer(session, { type: "revisit", noteId: "missing" }),
  session,
);
notes[0].content = "Changed by live topology";
notes[0].confidence = 0.9;
links.push(parent("root", "other"));
assert.equal(
  snapshot.notes.get("root").content,
  "Content root",
  "Snapshot content remains captured",
);
assert.equal(
  snapshot.notes.get("root").confidence,
  0.25,
  "Review does not mutate confidence",
);
assert.deepEqual(snapshot.cardIds, ["root", "10", "2", "grandchild"]);
const latestSnapshot = createNoteLearningSnapshot(
  indexNotesFamilies(buildNotesForest(notes, links)),
  "root",
);
assert.equal(
  latestSnapshot.notes.get("root").content,
  "Changed by live topology",
);
assert.equal(
  latestSnapshot.cardIds.includes("other"),
  true,
  "Restart uses latest membership",
);
session = noteLearningReducer(session, {
  type: "start",
  snapshot: latestSnapshot,
});
assert.equal(session.currentIndex, 0);
assert.equal(session.outcomes.size, 0);
assert.equal(session.mode, "active");
assert.equal(session.expandedGroupIds.has("10"), true);
assert.equal(noteLearningReducer(session, { type: "exit" }), null);
for (const outcome of ["reviewed", "skipped"]) {
  const leaf = noteLearningReducer(null, {
    type: "start",
    snapshot: createNoteLearningSnapshot(families, "leaf"),
  });
  const complete = noteLearningReducer(leaf, { type: "decide", outcome });
  assert.equal(complete.mode, "completed");
  assert.equal(complete.outcomes.get("leaf"), outcome);
}
const cycle = indexNotesFamilies(
  buildNotesForest(
    [note("a"), note("b")],
    [parent("a", "b"), parent("b", "a")],
  ),
);
assert.deepEqual(
  createNoteLearningSnapshot(cycle, "a").cardIds,
  ["a", "b"],
  "Cycle normalized exactly once",
);
console.log(
  "verify-note-learning: PASSED (BFS, paths, snapshots, outcomes, revisit, restart, leaf, cycles)",
);
