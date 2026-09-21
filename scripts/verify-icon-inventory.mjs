/**
 * Structural check: production chat/home icon sizes match Plan B densified
 * 3-role token system (control-toolbar / control-badge / glyph-inline).
 * Drives real source files (no hard-coded pass without reading code).
 *
 * Run: node scripts/verify-icon-inventory.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const globals = read("src/app/globals.css");
const iconTokens = read("src/lib/icon-tokens.ts");
const home = read("src/app/home/page.tsx");
const chatPage = read("src/app/(workspace)/chat/page.tsx");
const chatUi = `${home}\n${chatPage}`;
// Domain SoT paths (barrel consumers; icon paths under sidebar/overlays/prompt).
const sidebar = read("src/components/chat/sidebar/header/header.tsx");
const sidebarItem = read("src/components/chat/sidebar/chrome/item.tsx");
const attachments = read(
  "src/components/chat/prompt/attachments/attachment-chip.tsx",
);
const palette = read("src/components/chat/overlays/command-palette.tsx");
const conversation = read("src/components/chat/conversation/conversation.tsx");
const promptSubmit = read("src/components/chat/prompt/footer/submit.tsx");
const speechInput = read("src/components/chat/prompt/footer/speech-input.tsx");
const promptInput = read("src/components/chat/prompt/shell/prompt-input.tsx");

// ── CSS + TS tokens (Plan B 3-role system) ──────────────────────────
assert(
  globals.includes("--control-toolbar-box: 32px") &&
    globals.includes("--control-toolbar-glyph: 20px") &&
    globals.includes("--control-badge-box: 18px") &&
    globals.includes("--control-badge-glyph: 14px") &&
    globals.includes("--glyph-inline-size: 16px") &&
    globals.includes("--radius-badge:"),
  "globals.css defines Plan B icon control tokens"
);
assert(
  iconTokens.includes("toolbar: 20") &&
    iconTokens.includes("badge: 14") &&
    iconTokens.includes("inline: 16"),
  "src/lib/icon-tokens.ts ICON_GLYPH has toolbar 20 / badge 14 / inline 16"
);

// ── Home footer tools: 32 box + toolbar glyph 20 ────────────────────
assert(
  /size="icon-sm"/.test(promptInput) &&
    !promptInput.includes("[&_button]:!size-8"),
  "prompt icon tools use icon-sm (32px); no blanket [&_button]:!size-8 (that clips model/mode chips)"
);
assert(
  /<Plus[^>]*size=\{ICON_GLYPH\.inline\}/.test(promptInput) ||
    /<Plus[^>]*size=\{16\}/.test(promptInput),
  "home attach tool glyph size=16 (inline, matches 11px chips)"
);
assert(
  /<Globe[^>]*size=\{ICON_GLYPH\.inline\}/.test(promptInput) ||
    /<Globe[^>]*size=\{16\}/.test(promptInput),
  "home web tool glyph size=16 (inline, matches 11px chips)"
);
assert(
  /<Settings[^>]*size=\{ICON_GLYPH\.toolbar\}/.test(promptInput) ||
    /<Settings[^>]*size=\{20\}/.test(promptInput),
  "home model-fallback settings glyph size=20 (toolbar)"
);
assert(
  (chatUi.includes("!size-8") && chatUi.includes("PromptInputSubmit")) ||
    (promptInput.includes("!size-8") && promptInput.includes("PromptInputSubmit")),
  "home submit path uses size-8 control"
);
// Model check: badge-scale 14, not 10
assert(
  !/<Check[^>]*size=\{10\}/.test(chatUi) &&
    !/<Check[^>]*size=\{10\}/.test(promptInput),
  "home has no model check size={10}"
);
assert(
  /<Check[^>]*size=\{ICON_GLYPH\.badge\}/.test(promptInput) ||
    /<Check[^>]*size=\{14\}/.test(promptInput),
  "home model/mode check uses size=14 (badge)"
);

// ── Prompt submit toolbar glyphs → 20 (ActionMenu deleted; no menu plus) ─
assert(
  /size=\{ICON_GLYPH\.toolbar\}/.test(promptSubmit) ||
    /size=\{20\}/.test(promptSubmit),
  "prompt-input submit path uses toolbar glyph size"
);

// ── Speech mic in toolbar-ish control → 20 ──────────────────────────
assert(
  /<Mic[^>]*size=\{ICON_GLYPH\.inline\}/.test(speechInput) ||
    /<Mic[^>]*size=\{16\}/.test(speechInput),
  "speech-input mic glyph size=16 (inline, matches 11px chips)"
);

// ── Sidebar collapse: size-8 (not size-10) + glyph 20 ───────────────
assert(
  !sidebar.includes("size-10"),
  "sidebar has NO size-10 (collapse densified to size-8)"
);
assert(
  /flex size-8 items-center justify-center/.test(sidebar) &&
    (/<PanelLeft(Close|Open)[^>]*size=\{ICON_GLYPH\.toolbar\}/.test(sidebar) ||
      /<PanelLeft(Close|Open)[^>]*size=\{20\}/.test(sidebar)),
  "sidebar collapse is size-8 box + panel glyph 20"
);

// ChatSidebarItem: control-toolbar 32 box + glyph 20 (size-8 on icon span, not outer button)
assert(
  sidebarItem.includes("flex size-8 shrink-0 items-center justify-center") &&
    (sidebarItem.includes("<Icon size={ICON_GLYPH.toolbar} />") ||
      sidebarItem.includes("<Icon size={20} />")),
  "ChatSidebarItem icon wrapper size-8 + glyph toolbar 20"
);
assert(
  !/function ChatSidebarItem[\s\S]{0,500}className=\{cn\(\s*"[^"]*size-8/.test(
    sidebarItem
  ),
  "ChatSidebarItem outer button is not a size-8 square (w-full row)"
);
assert(
  !/function ChatSidebarItem[\s\S]{0,500}\bgap-2\b/.test(sidebarItem) &&
    !/function ChatSidebarItem[\s\S]{0,500}\bpx-3\b/.test(sidebarItem),
  "ChatSidebarItem button has no gap-2 / px-3 (actions/footer own horizontal padding)"
);

// ── Attachment remove badge 18/14 ───────────────────────────────────
assert(
  attachments.includes("size-[18px]") &&
    (/<X[^>]*size=\{ICON_GLYPH\.badge\}/.test(attachments) ||
      /<X[^>]*size=\{14\}/.test(attachments)),
  "attachment remove badge 18px box + x glyph 14"
);

// ── Command palette close 32/20; row icons stay 16 ──────────────────
assert(
  palette.includes("size-8") &&
    (/<X[^>]*size=\{ICON_GLYPH\.toolbar\}/.test(palette) ||
      /<X[^>]*size=\{20\}/.test(palette)),
  "command palette close size-8 + x size 20"
);
assert(
  /<Search[^>]*size=\{16\}/.test(palette) ||
    /<Search[^>]*size=\{ICON_GLYPH\.inline\}/.test(palette),
  "command palette search stays glyph-inline 16"
);

// ── Scroll-to-bottom 32 box + glyph 20 ──────────────────────────────
assert(
  conversation.includes("!size-8") || conversation.includes("size-8"),
  "conversation scroll control uses size-8 class family"
);
assert(
  /size=\{ICON_GLYPH\.toolbar\}/.test(conversation) ||
    /size=\{20\}/.test(conversation),
  "conversation scroll glyph size=20 (toolbar)"
);

if (process.exitCode) {
  console.error("\nverify-icon-inventory: FAILED");
  process.exit(1);
}
console.log("\nverify-icon-inventory: PASSED");
