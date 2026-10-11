/**
 * Drive shipped notes forest builder (PARENT_OF only).
 *
 * Run: npx tsx scripts/verify-notes-forest.mjs
 * Or:  npm run verify:notes-forest
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

const { buildNotesForest, indexNotesFamilies } = await import(
  pathToFileURL(
    path.join(root, "src/components/chat/sidebar/notes/notes-forest.ts"),
  ).href
);

const notes = [
  { id: "ideas", name: "Ideas", content: "", impression: "", confidence: 1 },
  {
    id: "telepathy",
    name: "Writing is telepathy",
    content: "",
    impression: "",
    confidence: 1,
  },
  { id: "meta", name: "Meta", content: "", impression: "", confidence: 1 },
  {
    id: "evergreen",
    name: "Evergreen notes",
    content: "",
    impression: "",
    confidence: 1,
  },
  { id: "lonely", name: "Travel", content: "", impression: "", confidence: 1 },
];

const links = [
  { source: "ideas", target: "telepathy", type: "PARENT_OF" },
  { source: "ideas", target: "evergreen", type: "PARENT_OF" },
  { source: "ideas", target: "telepathy", type: "RELATES_TO" },
  { source: "missing", target: "lonely", type: "PARENT_OF" },
];

const forest = buildNotesForest(notes, links);
const byId = Object.fromEntries(forest.map((n) => [n.note.id, n]));

assert(forest.length === 3, "three roots (ideas, meta, travel)");
assert(
  forest.map((n) => n.note.name).join(",") === "Ideas,Meta,Travel",
  "roots sorted by name: Ideas, Meta, Travel",
);
assert(byId.ideas.children.length === 2, "ideas has two PARENT_OF children");
assert(
  byId.ideas.children.map((c) => c.note.id).join(",") ===
    "evergreen,telepathy",
  "children sorted by name; RELATES_TO ignored; first PARENT_OF wins",
);
assert(byId.meta.children.length === 0, "meta is a leaf root");
assert(
  byId.lonely.children.length === 0,
  "orphan PARENT_OF to missing parent is ignored; Travel stays root",
);

const cycleNotes = [
  { id: "a", name: "A", content: "", impression: "", confidence: 1 },
  { id: "b", name: "B", content: "", impression: "", confidence: 1 },
];
const cycleLinks = [
  { source: "a", target: "b", type: "PARENT_OF" },
  { source: "b", target: "a", type: "PARENT_OF" },
];
const cycleForest = buildNotesForest(cycleNotes, cycleLinks);
assert(cycleForest.length === 1, "cycle: leftover walk yields one root");
const cycleRoot = cycleForest[0];
assert(
  cycleRoot.note.id === "a" &&
    cycleRoot.children.length === 1 &&
    cycleRoot.children[0].note.id === "b" &&
    cycleRoot.children[0].children.length === 0,
  "cycle does not recurse forever; A is root, B is child",
);

const families = indexNotesFamilies(forest);
assert(families.size === notes.length, "every note is indexed as a family");
assert(families.get("ideas").parentId === null, "root family backs to All topics");
assert(families.get("telepathy").parentId === "ideas", "child family backs to its parent");
assert(families.get("meta").node.children.length === 0, "leaf family has no children to browse");
const nested = buildNotesForest(notes, [...links,
  {source: "evergreen", target: "meta", type: "PARENT_OF"},
]);
const nestedFamilies = indexNotesFamilies(nested);
assert(nestedFamilies.get("meta").parentId === "evergreen", "deep family has its immediate parent");
assert(nestedFamilies.get("evergreen").parentId === "ideas", "deep family can return through each ancestor");
const refreshedFamilies = indexNotesFamilies(buildNotesForest(
  notes.filter((note) => note.id !== "evergreen"), links,
));
assert(!refreshedFamilies.has("evergreen"), "refresh removes deleted families");
assert(refreshedFamilies.get("ideas").node.children.length === 1, "refresh rebuilds remaining children");
assert(indexNotesFamilies(cycleForest).size === 2, "family index retains cycle-safe forest behavior");

if (failed) {
  console.error("\nverify-notes-forest: FAILED");
  process.exit(1);
}
console.log("\nverify-notes-forest: PASSED");
