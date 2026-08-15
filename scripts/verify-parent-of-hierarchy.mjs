/**
 * Drive shipped PARENT_OF rank / color / one-parent helpers.
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
  files.push(path.join(root, "AGENTS.md"), path.join(root, "brief.md"));
  return files.map((p) => ({
    rel: path.relative(root, p),
    text: fs.readFileSync(p, "utf8"),
  }));
}

const {
  findNodeRanks,
  findNodeColors,
  findNodeSizes,
  childHasIncomingParentOf,
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

const existing = [
  { source: "dsa", target: "arrays", type: "PARENT_OF" },
  { source: "dsa", target: "graphs", type: "PARENT_OF" },
];
assert(
  childHasIncomingParentOf(existing, "arrays"),
  "arrays already has incoming PARENT_OF — second parent rejected",
);
assert(
  !childHasIncomingParentOf(existing, "heaps"),
  "heaps has no parent — PARENT_OF dsa→heaps allowed",
);
assert(
  childHasIncomingParentOf(existing, "graphs"),
  "graphs already a child of dsa",
);
assert(
  !childHasIncomingParentOf(
    [{ source: "dsa", target: "arrays", type: "RELATES_TO" }],
    "arrays",
  ),
  "RELATES_TO is not a parent",
);

const live = collectLiveText();
const partOfHits = live.filter((f) => f.text.includes("PART_OF"));
assert(
  partOfHits.length === 0,
  partOfHits.length === 0
    ? "no live PART_OF in src/ + AGENTS.md + brief.md"
    : `leftover PART_OF in ${partOfHits.map((f) => f.rel).join(", ")}`,
);

const canvas = fs.readFileSync(
  path.join(root, "src/components/graph/sigma-canvas.tsx"),
  "utf8",
);
assert(
  canvas.includes('link.type === "PARENT_OF"'),
  "canvas compares hierarchy as PARENT_OF",
);
assert(
  !/isPartOf \? link\.target : link\.source/.test(canvas),
  "canvas does not flip PARENT_OF endpoints",
);
assert(
  canvas.includes("addEdge(link.source, link.target"),
  "canvas maps source→target as stored",
);
assert(
  canvas.includes('type: isParentOf ? "arrow" : "line"') &&
    canvas.includes("strengthFromChildRank"),
  "strength/arrow still hierarchy vs RELATES",
);

const toolset = fs.readFileSync(
  path.join(root, "src/ai/tools/toolset.ts"),
  "utf8",
);
assert(
  toolset.includes("falkorCreateParentOfLink") ||
    toolset.includes("createParentOfLink"),
  "linkMemories uses atomic createParentOfLink for PARENT_OF",
);
assert(
  !toolset.includes('hasIncomingLink(target, "PARENT_OF")'),
  "toolset does not check-then-create PARENT_OF (TOCTOU)",
);
assert(
  !toolset.includes("hasOutgoingLink(source"),
  "old outgoing-from-child PART_OF guard is gone",
);

const falkor = fs.readFileSync(path.join(root, "src/lib/falkor.ts"), "utf8");
assert(
  falkor.includes("export async function createParentOfLink"),
  "falkor exports createParentOfLink",
);
assert(
  falkor.includes("OPTIONAL MATCH (other)-[existing:PARENT_OF]->(target)") &&
    (falkor.includes("other.id <> $source") ||
      falkor.includes("WHERE other.id <> $source")) &&
    falkor.includes("WHERE existing IS NULL"),
  "createParentOfLink Cypher blocks only a different parent (other.id <> $source)",
);

if (failed > 0) {
  console.error(`\nverify:parent-of-hierarchy failed (${failed})`);
  process.exit(1);
}
console.log("\nverify:parent-of-hierarchy passed");
