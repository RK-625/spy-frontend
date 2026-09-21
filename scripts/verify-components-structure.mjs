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
  "src/components/chat/sidebar/chrome/route-switcher-strip.tsx",
  "src/components/chat/sidebar/header/header.tsx",
  "src/components/chat/sidebar/body/body.tsx",
  "src/components/chat/sidebar/actions/actions.tsx",
  "src/components/chat/sidebar/recents/recents.tsx",
  "src/components/chat/sidebar/recents/recents-row.tsx",
  "src/components/chat/sidebar/notes/notes.tsx",
  "src/components/chat/sidebar/notes/notes-row.tsx",
  "src/components/chat/sidebar/notes/notes-forest.ts",
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

  // Workspace shell (route group is not in the URL)
  "src/app/(workspace)/layout.tsx",
  "src/app/(workspace)/chat/page.tsx",
  "src/app/(workspace)/notes/page.tsx",
  "src/app/(workspace)/notes/[id]/page.tsx",
  "src/app/(workspace)/graph/page.tsx",
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
  "src/components/dotmatrix/icons",
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
  // graph / notes live under the workspace group, not as top-level app routes
  "src/app/graph/page.tsx",
  "src/app/notes/page.tsx",
  "src/app/notes/[id]/page.tsx",
  "src/app/(workspace)/notes/[id]/loading.tsx",
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

const chatContext = fs.readFileSync(
  path.join(root, "src/contexts/ChatContext.tsx"),
  "utf8",
);
if (
  /target = isNew[\s\S]{0,80}window\.location\.pathname/.test(chatContext) ||
  /\$\{window\.location\.pathname\}\?c=/.test(chatContext)
) {
  failures.push(
    "ChatContext must not write history using window.location.pathname",
  );
}
if (
  !chatContext.includes('const CHAT_PATH = "/chat"') ||
  !chatContext.includes("function buildChatUrl") ||
  !chatContext.includes("const target = buildChatUrl")
) {
  failures.push("ChatContext must build chat URLs from CHAT_PATH /chat");
}
if (
  !chatContext.includes("router.push(CHAT_PATH)") ||
  !chatContext.includes("router.push(buildChatUrl")
) {
  failures.push(
    "newChat/switchChat must router.push /chat when switching off-route",
  );
}
if (
  chatContext.includes("selectedNote") ||
  chatContext.includes("setSelectedNote")
) {
  failures.push("ChatContext must not hold selectedNote");
}
const chatTypes = fs.readFileSync(
  path.join(root, "src/types/chat.ts"),
  "utf8",
);
if (
  chatTypes.includes("selectedNote") ||
  chatTypes.includes("setSelectedNote")
) {
  failures.push("src/types/chat.ts must not declare selectedNote");
}
const chatPage = fs.readFileSync(
  path.join(root, "src/app/(workspace)/chat/page.tsx"),
  "utf8",
);
if (
  chatPage.includes("NoteWorkspace") ||
  chatPage.includes("selectedNote") ||
  chatPage.includes("setSelectedNote")
) {
  failures.push(
    "chat page must be conversation-only (no NoteWorkspace overlay)",
  );
}
const sidebar = fs.readFileSync(
  path.join(root, "src/components/chat/sidebar/chat-sidebar.tsx"),
  "utf8",
);
if (sidebar.includes("spy-sidebar-panel")) {
  failures.push(
    "sidebar notes surface must follow the URL, not spy-sidebar-panel",
  );
}
if (!sidebar.includes("RouteSwitcherStrip")) {
  failures.push("sidebar must render RouteSwitcherStrip");
}
if (!sidebar.includes('router.push("/chat")')) {
  failures.push("Chat tab must router.push /chat");
}
if (!sidebar.includes('router.push("/notes")')) {
  failures.push("Notes item must router.push /notes");
}
if (!sidebar.includes('router.push("/graph")')) {
  failures.push("Graph tab must router.push /graph");
}
const handleOpenChatFn = sidebar.match(
  /const handleOpenChat = useCallback\(\(\) => \{([\s\S]*?)\}, \[/,
);
if (!handleOpenChatFn) {
  failures.push("sidebar must define handleOpenChat");
} else if (handleOpenChatFn[1].includes("newChat(")) {
  failures.push("Chat tab handler must not call newChat()");
} else if (!handleOpenChatFn[1].includes('router.push("/chat")')) {
  failures.push("Chat tab handler must router.push /chat");
}
if (
  sidebar.includes("handleDismissNotes") ||
  /setSelectedNote\(null\)/.test(sidebar)
) {
  failures.push("Cmd+B must be width-only; must not dismiss notes to /chat");
}
if (/!isNotesRoute\s*\?\s*\([\s\S]{0,800}ChatSidebarFooter/.test(sidebar)) {
  failures.push("Settings footer must not be gated on !isNotesRoute");
}
const notesTree = fs.readFileSync(
  path.join(root, "src/components/chat/sidebar/notes/notes.tsx"),
  "utf8",
);
if (
  notesTree.includes("setSelectedNote") ||
  notesTree.includes("selectedNote,")
) {
  failures.push("notes tree must select via the URL, not setSelectedNote");
}
if (!notesTree.includes("`/notes/${encodeURIComponent(noteId)}`")) {
  failures.push("notes tree must router.push /notes/[id]");
}
const noteByIdPage = fs.readFileSync(
  path.join(root, "src/app/(workspace)/notes/[id]/page.tsx"),
  "utf8",
);
const noteWorkspace = fs.readFileSync(
  path.join(root, "src/components/chat/workspace/note-workspace.tsx"),
  "utf8",
);
if (!noteByIdPage.includes("getMemory(")) {
  failures.push("notes [id] page must snapshot via getMemory");
}
if (!noteByIdPage.includes("<Suspense")) {
  failures.push("notes [id] page must Suspense the getMemory body");
}
if (!noteByIdPage.includes("Note not found.")) {
  failures.push("notes [id] page missing copy must be Note not found.");
}
if (!noteByIdPage.includes("Couldn&apos;t load notes")) {
  failures.push("notes [id] page error copy must match the notes tree");
}
if (!noteByIdPage.includes("DotmHex9")) {
  failures.push("notes [id] page loading fallback must use DotmHex9");
}
if (noteByIdPage.includes('"use client"')) {
  failures.push("notes [id] page must stay a Server Component");
}
if (noteByIdPage.includes('fetch("/api/graph")')) {
  failures.push("notes [id] page must not fetch GET /api/graph");
}
if (
  noteByIdPage.includes("notFound(") ||
  /router\.(push|replace)\(\s*["'`]\/chat/.test(noteByIdPage)
) {
  failures.push("notes [id] must not leave the notes shell for missing/error");
}
if (!noteWorkspace.includes('router.push("/notes")')) {
  failures.push("NoteWorkspace must close via router.push /notes");
}
if (!noteWorkspace.includes('aria-label="Close note"')) {
  failures.push("NoteWorkspace must offer Close note");
}
if (!noteWorkspace.includes('event.key === "Escape"')) {
  failures.push("NoteWorkspace must dismiss on Escape");
}
if (!noteWorkspace.includes("{children}")) {
  failures.push("NoteWorkspace must take children as the note body");
}
if (!noteWorkspace.includes("readOnly={true}")) {
  failures.push("NoteWorkspace Milkdown must stay readOnly");
}
const graphEditor = fs.readFileSync(
  path.join(root, "src/components/graph/editor/editor.tsx"),
  "utf8",
);
if (
  !graphEditor.includes("`/notes/${encodeURIComponent(node.id)}`") &&
  !(
    graphEditor.includes("encodeURIComponent(node.id)") &&
    graphEditor.includes("/notes/")
  )
) {
  failures.push(
    "graph editor Open note must router.push /notes/[id] from node.id",
  );
}
if (!graphEditor.includes("Open note")) {
  failures.push("graph editor must offer Open note");
}
if (
  /[`'"]\/notes\/\$\{(?:encodeURIComponent\()?node\.name/.test(graphEditor)
) {
  failures.push("graph editor must not navigate with node.name");
}
const workspaceLayout = fs.readFileSync(
  path.join(root, "src/app/(workspace)/layout.tsx"),
  "utf8",
);
if (/PromptInputProvider\s+key=\{chatId\}/.test(workspaceLayout)) {
  failures.push(
    "PromptInputProvider key={chatId} must not wrap ChatSidebar / graph children",
  );
}
if (fs.existsSync(path.join(root, "src/app/home"))) {
  failures.push("src/app/home was removed; / is the landing page and /chat is the workspace");
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
