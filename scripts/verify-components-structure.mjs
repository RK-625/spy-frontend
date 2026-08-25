/**
 * Structural check: src/components domain layout after reorg.
 * Asserts required folders/files exist and forbidden legacy paths are gone.
 *
 * Domain SoT homes are required. Dual-path root shims (chat, dotmatrix) are
 * forbidden; public surfaces are domain barrels (e.g. `@/components/dotmatrix`).
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
  // ui primitives — role folders + barrel (no flat dual shims)
  "src/components/ui/index.ts",
  "src/components/ui/actions/button.tsx",
  "src/components/ui/actions/button-group.tsx",
  "src/components/ui/forms/input.tsx",
  "src/components/ui/forms/input-group.tsx",
  "src/components/ui/overlays/dialog.tsx",
  "src/components/ui/overlays/tooltip.tsx",
  "src/components/ui/feedback/spinner.tsx",
  "src/components/ui/layout/card.tsx",
  "src/components/ui/navigation/command.tsx",

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
  "src/components/chat/prompt/index.ts",
  "src/components/chat/conversation/conversation.tsx",
  "src/components/chat/conversation/message.tsx",
  "src/components/chat/sidebar/index.ts",
  "src/components/chat/sidebar/chat-sidebar.tsx",
  "src/components/chat/sidebar/chrome/item.tsx",
  "src/components/chat/sidebar/chrome/rail.tsx",
  "src/components/chat/sidebar/header/header.tsx",
  "src/components/chat/sidebar/body/body.tsx",
  "src/components/chat/sidebar/actions/actions.tsx",
  "src/components/chat/sidebar/recents/recents.tsx",
  "src/components/chat/sidebar/recents/recents-row.tsx",
  "src/components/chat/sidebar/footer/footer.tsx",
  "src/components/chat/overlays/index.ts",
  "src/components/chat/overlays/command-palette.tsx",
  "src/components/chat/overlays/settings-dialog.tsx",
  "src/components/chat/conversation/index.ts",
  "src/components/chat/index.ts",

  // landing
  "src/components/landing/hero-section.tsx",
  "src/components/landing/shiny-text.tsx",
  "src/components/landing/shiny-text.css",

  // dotmatrix — domain SoT + barrel only (no root dual shims)
  "src/components/dotmatrix/index.ts",
  "src/components/dotmatrix/core/core.tsx",
  "src/components/dotmatrix/core/hooks.ts",
  "src/components/dotmatrix/core/index.ts",
  "src/components/dotmatrix/icons/icons.tsx",
  "src/components/dotmatrix/icons/index.ts",
  "src/components/dotmatrix/loaders/loader.css",
  "src/components/dotmatrix/loaders/hex-9.tsx",
  "src/components/dotmatrix/loaders/square-18.tsx",
  "src/components/dotmatrix/loaders/triangle-16.tsx",
  "src/components/dotmatrix/loaders/index.ts",

  // logos (provider marks)
  "src/components/logos/openai.tsx",
  "src/components/logos/anthropic-white.tsx",
  "src/components/logos/google.tsx",
  "src/components/logos/deepseek.tsx",
  "src/components/logos/meta.tsx",

  // graph host
  "src/components/graph/sigma-canvas.tsx",
  "src/components/graph/editor/editor.tsx",
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
  // dual-path shims removed — domain barrels only
  "src/components/chat/ai-elements",
  "src/components/chat/chat-sidebar.tsx",
  "src/components/chat/settings-dialog.tsx",
  "src/components/chat/command-palette.tsx",
  "src/components/chat/shell",
  "src/components/chat/prompt/prompt-input.tsx",
  "src/components/chat/prompt/prompt-input-files.ts",
  "src/components/chat/prompt/prompt-input-attachments.tsx",
  "src/components/chat/prompt/attachments.tsx",
  "src/components/chat/prompt/model-selector.tsx",
  "src/components/chat/prompt/speech-input.tsx",
  "src/components/chat/prompt/prompt-input-controls.tsx",
  // dotmatrix root dual-path shims removed — use @/components/dotmatrix barrel
  "src/components/dotmatrix/core.tsx",
  "src/components/dotmatrix/hooks.ts",
  "src/components/dotmatrix/icons.tsx",
  "src/components/dotmatrix/loader.css",
  "src/components/dotmatrix/hex-9.tsx",
  "src/components/dotmatrix/square-18.tsx",
  "src/components/dotmatrix/triangle-16.tsx",
  // brand/logos moved to logos/
  "src/components/brand",
  // ui flat dual-export paths removed — use role folders / barrel
  "src/components/ui/button.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/tooltip.tsx",
  "src/components/ui/command.tsx",
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

// Dual-path root shims forbidden (chat + dotmatrix); no thin-re-export walk.

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
