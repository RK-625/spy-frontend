/**
 * Structural check: src/components domain layout after reorg.
 * Asserts required folders/files exist and forbidden legacy paths are gone.
 *
 * Domain SoT homes are required; legacy shim paths remain required as the
 * public compat surface (re-exports only).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const components = path.join(root, "src/components");

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function isEmptyDir(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return false;
  return fs.readdirSync(p).length === 0;
}

const required = [
  // ui primitives
  "src/components/ui/button.tsx",

  // chat — domain SoT (prompt shell reorg)
  "src/components/chat/prompt/shell/context.tsx",
  "src/components/chat/prompt/shell/prompt-input.tsx",
  "src/components/chat/prompt/header/header.tsx",
  "src/components/chat/prompt/body/body.tsx",
  "src/components/chat/prompt/body/textarea.tsx",
  "src/components/chat/prompt/ask/pending-ask.tsx",
  "src/components/chat/prompt/attachments/prompt-input-files.ts",
  "src/components/chat/prompt/attachments/attachment-chip.tsx",
  "src/components/chat/prompt/attachments/attachment-strip.tsx",
  "src/components/chat/prompt/footer/footer.tsx",
  "src/components/chat/prompt/footer/tools.tsx",
  "src/components/chat/prompt/footer/button.tsx",
  "src/components/chat/prompt/footer/submit.tsx",
  "src/components/chat/prompt/footer/speech-input.tsx",
  "src/components/chat/prompt/footer/model-selector.tsx",
  "src/components/chat/prompt/suggestion.tsx",
  "src/components/chat/prompt/index.ts",
  // chat — prompt root compat shims (historical flat paths)
  "src/components/chat/prompt/prompt-input.tsx",
  "src/components/chat/prompt/prompt-input-files.ts",
  "src/components/chat/prompt/attachments.tsx",
  "src/components/chat/conversation/conversation.tsx",
  "src/components/chat/conversation/message.tsx",
  "src/components/chat/shell/chat-sidebar.tsx",
  "src/components/chat/shell/command-palette.tsx",
  "src/components/chat/shell/settings-dialog.tsx",
  "src/components/chat/index.ts",

  // chat — compat shims (public surface; re-exports only)
  "src/components/chat/chat-sidebar.tsx",
  "src/components/chat/settings-dialog.tsx",
  "src/components/chat/command-palette.tsx",
  "src/components/chat/ai-elements/prompt-input.tsx",
  "src/components/chat/ai-elements/index.ts",

  // landing
  "src/components/landing/hero-section.tsx",
  "src/components/landing/shiny-text.tsx",
  "src/components/landing/shiny-text.css",

  // dotmatrix — domain SoT
  "src/components/dotmatrix/core/core.tsx",
  "src/components/dotmatrix/core/hooks.ts",
  "src/components/dotmatrix/icons/icons.tsx",
  "src/components/dotmatrix/loaders/loader.css",
  "src/components/dotmatrix/loaders/hex-9.tsx",
  "src/components/dotmatrix/loaders/square-18.tsx",
  "src/components/dotmatrix/loaders/triangle-16.tsx",

  // dotmatrix — compat shims
  "src/components/dotmatrix/core.tsx",
  "src/components/dotmatrix/hooks.ts",
  "src/components/dotmatrix/icons.tsx",
  "src/components/dotmatrix/loader.css",
  "src/components/dotmatrix/hex-9.tsx",
  "src/components/dotmatrix/square-18.tsx",
  "src/components/dotmatrix/triangle-16.tsx",

  // brand
  "src/components/brand/logos/openai.tsx",
  "src/components/brand/logos/anthropic-white.tsx",
  "src/components/brand/logos/google.tsx",
  "src/components/brand/logos/deepseek.tsx",

  // graph host
  "src/components/graph/graph-canvas.tsx",
  "src/components/graph/node-detail-dialog.tsx",
];

const forbidden = [
  "src/components/ai-elements",
  "src/components/ChatSidebar.tsx",
  "src/components/chat/ChatSidebar.tsx",
  "src/components/chat/SettingsDialog.tsx",
  "src/components/ui/ShinyText.tsx",
  "src/components/ui/command-palette.tsx",
  "src/components/ui/dotmatrix-core.tsx",
  "src/components/ui/dotmatrix-hooks.ts",
  "src/components/ui/dotm-hex-9.tsx",
  "src/components/ui/svgs",
  "src/components/dotmatrix-loader.css",
  "src/components/chat/ai-elements/dot-matrix-icons.tsx",
];

const failures = [];

for (const rel of required) {
  if (!exists(rel)) failures.push(`missing required: ${rel}`);
}

for (const rel of forbidden) {
  if (exists(rel)) failures.push(`forbidden path still exists: ${rel}`);
}

// No empty top-level folders under components
for (const name of fs.readdirSync(components)) {
  const p = path.join(components, name);
  if (fs.statSync(p).isDirectory() && fs.readdirSync(p).length === 0) {
    failures.push(`empty top-level folder: src/components/${name}`);
  }
}

// Module filenames under components should be kebab-case (allow .css)
function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

const pascalFile = /\/[A-Z][A-Za-z0-9]*\.(tsx|ts)$/;
for (const f of walk(components)) {
  if (pascalFile.test(f.replaceAll("\\", "/"))) {
    failures.push(`PascalCase module filename: ${path.relative(root, f)}`);
  }
}

// Layering: ui must not import from chat
const uiDir = path.join(components, "ui");
for (const f of walk(uiDir)) {
  if (!/\.(tsx|ts)$/.test(f)) continue;
  const text = fs.readFileSync(f, "utf8");
  if (text.includes("@/components/chat/")) {
    failures.push(`ui imports chat: ${path.relative(root, f)}`);
  }
}

// Compat shims must re-export domain SoT (not hold large impl bodies).
// Walk ai-elements/* plus known root/dotmatrix shims.
const REEXPORT_BUDGET_LINES = 40; // allow brief header comments + export *

function isThinReExport(text, domainRe) {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .trim();
  if (!domainRe.test(text)) return false;
  // Only export statements / blank lines after comment strip.
  const codeLines = stripped
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (codeLines.length === 0 || codeLines.length > REEXPORT_BUDGET_LINES) {
    return false;
  }
  return codeLines.every(
    (l) =>
      /^export\s+\*\s+from\s+["'][^"']+["']\s*;?$/.test(l) ||
      /^export\s+\{[^}]+\}\s+from\s+["'][^"']+["']\s*;?$/.test(l),
  );
}

const shimChecks = [
  // chat shell root shims
  ["src/components/chat/chat-sidebar.tsx", /export\s+\*\s+from\s+["']\.\/shell\//],
  ["src/components/chat/settings-dialog.tsx", /export\s+\*\s+from\s+["']\.\/shell\//],
  ["src/components/chat/command-palette.tsx", /export\s+\*\s+from\s+["']\.\/shell\//],
  // dotmatrix root shims
  ["src/components/dotmatrix/core.tsx", /export\s+\*\s+from\s+["']\.\/core\//],
  ["src/components/dotmatrix/hooks.ts", /export\s+\*\s+from\s+["']\.\/core\//],
  ["src/components/dotmatrix/icons.tsx", /export\s+\*\s+from\s+["']\.\/icons\//],
  ["src/components/dotmatrix/hex-9.tsx", /export\s+\*\s+from\s+["']\.\/loaders\//],
  ["src/components/dotmatrix/square-18.tsx", /export\s+\*\s+from\s+["']\.\/loaders\//],
  ["src/components/dotmatrix/triangle-16.tsx", /export\s+\*\s+from\s+["']\.\/loaders\//],
];
for (const [rel, re] of shimChecks) {
  if (!exists(rel)) continue;
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  if (!isThinReExport(text, re)) {
    failures.push(`compat shim should thin re-export domain SoT: ${rel}`);
  }
}

// loader.css shim is @import of loaders SoT (not TS export).
if (exists("src/components/dotmatrix/loader.css")) {
  const css = fs.readFileSync(
    path.join(root, "src/components/dotmatrix/loader.css"),
    "utf8",
  );
  if (!/@import\s+["']\.\/loaders\/loader\.css["']/.test(css)) {
    failures.push(
      "compat shim should @import domain SoT: src/components/dotmatrix/loader.css",
    );
  }
  if (css.split("\n").filter((l) => l.trim() && !l.trim().startsWith("/*")).length > 5) {
    failures.push(
      "compat shim loader.css should stay thin (@import only): src/components/dotmatrix/loader.css",
    );
  }
}

// Walk every file under ai-elements/ — each must re-export prompt|conversation.
const aiElementsDir = path.join(components, "chat/ai-elements");
if (fs.existsSync(aiElementsDir)) {
  for (const name of fs.readdirSync(aiElementsDir)) {
    const abs = path.join(aiElementsDir, name);
    if (!fs.statSync(abs).isFile()) continue;
    if (!/\.(tsx?|ts)$/.test(name)) continue;
    const rel = `src/components/chat/ai-elements/${name}`;
    const text = fs.readFileSync(abs, "utf8");
    const domainRe = /export\s+\*\s+from\s+["']\.\.\/(prompt|conversation)(?:\/[^"']*)?["']/;
    if (!isThinReExport(text, domainRe)) {
      failures.push(
        `ai-elements compat shim must thin re-export ../prompt|conversation: ${rel}`,
      );
    }
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      requiredCount: required.length,
      forbiddenChecked: forbidden.length,
      domains: fs.readdirSync(components).filter((n) =>
        fs.statSync(path.join(components, n)).isDirectory(),
      ),
    },
    null,
    2,
  ),
);
