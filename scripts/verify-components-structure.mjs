/**
 * Structural check: src/components domain layout after reorg.
 * Asserts required folders/files exist and forbidden legacy paths are gone.
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
  "src/components/ui/button.tsx",
  "src/components/chat/chat-sidebar.tsx",
  "src/components/chat/settings-dialog.tsx",
  "src/components/chat/command-palette.tsx",
  "src/components/chat/ai-elements/prompt-input.tsx",
  "src/components/landing/hero-section.tsx",
  "src/components/landing/shiny-text.tsx",
  "src/components/landing/shiny-text.css",
  "src/components/dotmatrix/core.tsx",
  "src/components/dotmatrix/hooks.ts",
  "src/components/dotmatrix/icons.tsx",
  "src/components/dotmatrix/loader.css",
  "src/components/dotmatrix/hex-9.tsx",
  "src/components/dotmatrix/square-18.tsx",
  "src/components/dotmatrix/triangle-16.tsx",
  "src/components/brand/logos/openai.tsx",
  "src/components/brand/logos/anthropic-white.tsx",
  "src/components/brand/logos/google.tsx",
  "src/components/brand/logos/deepseek.tsx",
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
