/**
 * Drive shipped PARENT_OF rank / color helpers.
 *
 * Run: npx tsx scripts/verify-parent-of-hierarchy.mjs
 * Or:  npm run verify:parent-of-hierarchy
 */
import fs from "node:fs";
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

function lum(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function collectLiveText() {
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      if (name.name === "node_modules" || name.name.startsWith(".")) continue;
      const p = path.join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else if (/\.(ts|tsx|md)$/.test(name.name)) files.push(p);
    }
  };
  walk(path.join(root, "src"));
  for (const extra of ["AGENTS.md", "Agents.md", "brief.md"]) {
    const p = path.join(root, extra);
    if (fs.existsSync(p)) files.push(p);
  }
  return files.map((p) => ({
    rel: path.relative(root, p),
    text: fs.readFileSync(p, "utf8"),
  }));
}

const {
  findNodeRanks,
  findNodeColors,
  findNodeSizes,
  buildLayoutGraph,
  POINT_SIZE_BASE_PX,
} = await import(
  pathToFileURL(path.join(root, "src/lib/graph-functions.ts")).href
);

const ids = ["dsa", "arrays", "binary-search", "networks", "tcp", "lonely"];
const links = [
  { source: "dsa", target: "arrays", type: "PARENT_OF" },
  { source: "arrays", target: "binary-search", type: "PARENT_OF" },
  { source: "networks", target: "tcp", type: "PARENT_OF" },
  { source: "dsa", target: "networks", type: "RELATES_TO" },
];

const { ranks, rootById } = findNodeRanks(ids, links);

assert(ranks.get("dsa") === 0, "dsa rank 0 (root)");
assert(ranks.get("arrays") === 1, "arrays rank 1");
assert(ranks.get("binary-search") === 2, "binary-search rank 2");
assert(ranks.get("networks") === 0, "networks rank 0 (own tree)");
assert(ranks.get("tcp") === 1, "tcp rank 1");
assert(ranks.get("lonely") === 0, "isolated rank 0");

assert(rootById.get("dsa") === "dsa", "dsa is its domain root");
assert(rootById.get("arrays") === "dsa", "arrays domain is dsa");
assert(rootById.get("binary-search") === "dsa", "binary-search domain is dsa");
assert(rootById.get("tcp") === "networks", "tcp domain is networks");
assert(rootById.get("lonely") == null, "isolated is uncategorized");
assert(
  rootById.get("networks") === "networks",
  "RELATES_TO does not attach networks under dsa",
);

const colors = findNodeColors({ ranks, rootById });
assert(colors.get("lonely") === "#c8acfb", "isolated stays lavender");
assert(
  colors.get("dsa") !== colors.get("networks"),
  "distinct domain roots get distinct colors",
);
assert(
  lum(colors.get("dsa")) > lum(colors.get("arrays")),
  "child darker than parent (dsa → arrays)",
);
assert(
  lum(colors.get("arrays")) > lum(colors.get("binary-search")),
  "grandchild darker than child",
);

const sizes = findNodeSizes({ ranks, rootById });
assert(
  sizes.get("dsa") === POINT_SIZE_BASE_PX,
  "root size POINT_SIZE_BASE_PX/(0+1)",
);
assert(sizes.get("arrays") === POINT_SIZE_BASE_PX / 2, "rank-1 size base/2");
assert(
  sizes.get("binary-search") === POINT_SIZE_BASE_PX / 3,
  "rank-2 size base/3",
);

const live = collectLiveText();
const partOfHits = live.filter((f) => f.text.includes("PART_OF"));
assert(
  partOfHits.length === 0,
  partOfHits.length === 0
    ? "no live PART_OF in src/ + AGENTS.md + brief.md"
    : `leftover PART_OF in ${partOfHits.map((f) => f.rel).join(", ")}`,
);

const layoutGraph = fs.readFileSync(
  path.join(root, "src/lib/graph-functions.ts"),
  "utf8",
);
assert(
  layoutGraph.includes('link.type === "PARENT_OF"'),
  "layout graph compares hierarchy as PARENT_OF",
);
assert(
  !/isPartOf \? link\.target : link\.source/.test(layoutGraph),
  "layout graph does not flip PARENT_OF endpoints",
);
assert(
  layoutGraph.includes("MultiDirectedGraph") &&
    layoutGraph.includes("addEdgeWithKey"),
  "layout graph is multi + keyed edges (typed parallels allowed)",
);
assert(
  !layoutGraph.includes("hasEdge(link.source, link.target)"),
  "layout graph does not skip on endpoint-only hasEdge",
);
assert(
  layoutGraph.includes('type: isParentOf ? "arrow" : "line"') &&
    layoutGraph.includes("strengthFromChildRank"),
  "strength/arrow still hierarchy vs RELATES",
);

const multiMemories = [
  { id: "a", name: "A", content: "", confidence: 1 },
  { id: "b", name: "B", content: "", confidence: 1 },
];
const typedPair = buildLayoutGraph(multiMemories, [
  { source: "a", target: "b", type: "PARENT_OF" },
  { source: "a", target: "b", type: "RELATES_TO" },
]);
assert(
  typedPair.size === 2 && typedPair.multi === true,
  "A PARENT_OF B + A RELATES_TO B → two edges on multi graph",
);
const dupParent = buildLayoutGraph(multiMemories, [
  { source: "a", target: "b", type: "PARENT_OF" },
  { source: "a", target: "b", type: "PARENT_OF" },
]);
assert(
  dupParent.size === 1 &&
    [...dupParent.edgeEntries()].every(
      ({ attributes }) => attributes.type === "arrow",
    ),
  "duplicate PARENT_OF A→B collapses to one hierarchy edge",
);

const canvas = fs.readFileSync(
  path.join(root, "src/components/graph/sigma-canvas.tsx"),
  "utf8",
);
assert(
  canvas.includes("buildLayoutGraph"),
  "canvas still seeds Sigma via buildLayoutGraph",
);

const toolset = fs.readFileSync(
  path.join(root, "src/ai/tools/toolset.ts"),
  "utf8",
);
assert(
  toolset.includes("manageLinks") &&
    toolset.includes("getDb") &&
    toolset.includes("graph.query"),
  "manageLinks runs one graph.query via getDb",
);
assert(
  !toolset.includes("falkorCreateLink") &&
    !toolset.includes("falkorDeleteLink") &&
    !toolset.includes("createParentOfLink") &&
    !toolset.includes("falkorCreateParentOfLink"),
  "manageLinks does not loop createLink/deleteLink or call createParentOfLink",
);
assert(
  (toolset.includes("UNWIND") || toolset.includes("MERGE")) &&
    toolset.includes("OPTIONAL MATCH (other)-[:PARENT_OF]") &&
    toolset.includes("all-or-nothing") &&
    !toolset.includes("failOrd") &&
    !toolset.includes("missing_endpoint") &&
    !toolset.includes("parent_blocked"),
  "manageLinks uses a simple write query (sticky in-query; no validate-first reason codes)",
);
assert(
  !toolset.includes("manageLinksOkBatch") &&
    !toolset.includes("classifyManageLinksFailure") &&
    !toolset.includes("failOrd"),
  "manageLinks has no classify/ok-batch / failOrd trail helpers",
);
assert(
  !toolset.includes("linkMemories"),
  "toolset has no linkMemories dual writer",
);
assert(
  !toolset.includes('hasIncomingLink(target, "PARENT_OF")'),
  "toolset does not check-then-create PARENT_OF (TOCTOU)",
);
assert(
  !toolset.includes("hasOutgoingLink(source"),
  "old outgoing-from-child PART_OF guard is gone",
);
assert(
  !toolset.includes("applyLinkBatch"),
  "no applyLinkBatch helper — batch Cypher lives in manageLinks",
);
assert(
  !/\$up\d+_source/.test(toolset) && !/\$rm\d+_source/.test(toolset),
  "manageLinks no longer unrolls upN/rmN clause params",
);
assert(
  !toolset.includes("falkorSetMemoryQuestions") &&
    !toolset.includes("setMemoryQuestions as falkorSetMemoryQuestions"),
  "upsertMemory tool path no longer calls setMemoryQuestions",
);
assert(
  toolset.includes("upsertMemory failed (all-or-nothing)") &&
    toolset.includes("memoryQuestionCreateCypher"),
  "upsertMemory is embed-then-one-query all-or-nothing",
);

const falkor = fs.readFileSync(path.join(root, "src/lib/falkor.ts"), "utf8");
assert(
  falkor.includes("export async function createParentOfLink"),
  "falkor exports createParentOfLink",
);
assert(
  falkor.includes("export async function createLink") &&
    falkor.includes('parsed.type === "PARENT_OF"') &&
    falkor.includes("createParentOfLink(parsed)"),
  "createLink delegates PARENT_OF to createParentOfLink",
);
assert(
  falkor.includes("export async function deleteLink"),
  "falkor exports deleteLink",
);
assert(
  !falkor.includes("isParentOfAncestor"),
  "falkor has no isParentOfAncestor cycle walk",
);
assert(
  falkor.includes("OPTIONAL MATCH (other)-[existing:PARENT_OF]->(target)") &&
    (falkor.includes("other.id <> $source") ||
      falkor.includes("WHERE other.id <> $source")) &&
    falkor.includes("WHERE existing IS NULL"),
  "createParentOfLink Cypher blocks only a different parent (other.id <> $source)",
);

const liveProduct = live.filter(
  (f) =>
    !f.rel.startsWith("plans/") &&
    (f.text.includes("linkMemories") ||
      f.text.includes("LINK_MEMORIES") ||
      f.text.includes("linkMemoriesInputSchema") ||
      f.text.includes("link-memories")),
);
assert(
  liveProduct.length === 0,
  liveProduct.length === 0
    ? "no leftover linkMemories product references in src/"
    : `leftover linkMemories in ${liveProduct.map((f) => f.rel).join(", ")}`,
);

if (failed > 0) {
  console.error(`\nverify:parent-of-hierarchy failed (${failed})`);
  process.exit(1);
}
console.log("\nverify:parent-of-hierarchy passed");
