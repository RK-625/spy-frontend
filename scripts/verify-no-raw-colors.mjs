/**
 * Guard: colors come from palette tokens, never raw values.
 * Raw colors (hex, rgb()/hsl()/oklch()…, Tailwind palette utilities like bg-black/30)
 * may only live in src/styles/tokens/palette-{light,dark}.css, so both themes stay in sync.
 *
 * Run: node scripts/verify-no-raw-colors.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = "src";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

/** Never theme-switched: the palettes themselves and fixed artwork. */
const EXEMPT_PATHS = [
  { path: "src/styles/tokens/", reason: "palette source of truth" },
  { path: "src/components/logos/", reason: "brand marks keep their own colors" },
  { path: "src/components/dotmatrix/core/core.tsx", reason: "opt-in decorative loader presets" },
];

/**
 * Not theme-aware yet. Each entry must still contain raw colors, so a finished
 * file fails the check until it is removed from this list.
 */
const PENDING_PATHS = [
  { path: "src/app/page.tsx", reason: "landing shader backdrop (theme sprint 4)" },
  { path: "src/components/landing/", reason: "landing hero text effects (theme sprint 4)" },
  { path: "src/components/graph/sigma-canvas.tsx", reason: "WebGL graph canvas (theme sprint 4)" },
  { path: "src/lib/graph-functions.ts", reason: "WebGL graph node colors (theme sprint 4)" },
];

const TAILWIND_COLOR_FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RAW_COLOR_PATTERNS = [
  { name: "hex", regex: /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g },
  { name: "color function", regex: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g },
  {
    name: "tailwind palette",
    regex: new RegExp(
      `\\b(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|shadow|divide|placeholder|caret|accent)-(?:white|black|(?:${TAILWIND_COLOR_FAMILIES})-\\d{2,3})(?:\\/\\d+)?\\b`,
      "g",
    ),
  },
];

function listSourceFiles(relDir) {
  const entries = fs.readdirSync(path.join(root, relDir), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const rel = path.posix.join(relDir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(rel);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [rel] : [];
  });
}

function matchesPath(rel, entries) {
  return entries.find((entry) => rel === entry.path || rel.startsWith(entry.path));
}

/** Blanks comments but keeps line numbers; `//` after `:` is a URL, not a comment. */
function stripComments(text) {
  const withoutBlocks = text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));
  return withoutBlocks
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

function findRawColors(rel) {
  const lines = stripComments(fs.readFileSync(path.join(root, rel), "utf8")).split("\n");
  return lines.flatMap((line, index) =>
    RAW_COLOR_PATTERNS.flatMap(({ name, regex }) =>
      [...line.matchAll(regex)].map((match) => ({
        location: `${rel}:${index + 1}`,
        kind: name,
        value: match[0],
      })),
    ),
  );
}

const violations = [];
const pendingWithColors = new Set();
for (const rel of listSourceFiles(SOURCE_DIR)) {
  if (matchesPath(rel, EXEMPT_PATHS)) continue;
  const found = findRawColors(rel);
  const pending = matchesPath(rel, PENDING_PATHS);
  if (pending) {
    if (found.length > 0) pendingWithColors.add(pending.path);
    continue;
  }
  violations.push(...found);
}

const stalePending = PENDING_PATHS.filter((entry) => !pendingWithColors.has(entry.path));

for (const violation of violations) {
  console.error(`FAIL: raw ${violation.kind} ${violation.value} at ${violation.location} — use a palette token`);
}
for (const entry of stalePending) {
  console.error(`FAIL: ${entry.path} has no raw colors left — remove it from PENDING_PATHS`);
}

const ok = violations.length === 0 && stalePending.length === 0;
console.log(
  JSON.stringify(
    {
      ok,
      violations: violations.length,
      pending: PENDING_PATHS.map((entry) => `${entry.path} — ${entry.reason}`),
    },
    null,
    2,
  ),
);
if (!ok) process.exitCode = 1;
