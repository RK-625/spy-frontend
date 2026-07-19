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
const sidebar = read("src/components/chat/chat-sidebar.tsx");
const attachments = read("src/components/chat/ai-elements/attachments.tsx");
const palette = read("src/components/chat/command-palette.tsx");
const conversation = read("src/components/chat/ai-elements/conversation.tsx");
const promptInput = read("src/components/chat/ai-elements/prompt-input.tsx");
const speechInput = read("src/components/chat/ai-elements/speech-input.tsx");

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
  home.includes("[&_button]:!size-8"),
  "home footer tools force !size-8 (32px box)"
);
assert(
  /DotMatrixIcon name="plus" size=\{ICON_GLYPH\.toolbar\}/.test(home) ||
    /DotMatrixIcon name="plus" size=\{20\}/.test(home),
  "home attach tool glyph size=20 (toolbar)"
);
assert(
  /DotMatrixIcon name="globe" size=\{ICON_GLYPH\.toolbar\}/.test(home) ||
    /DotMatrixIcon name="globe" size=\{20\}/.test(home),
  "home web tool glyph size=20 (toolbar)"
);
assert(
  /DotMatrixIcon name="settings" size=\{ICON_GLYPH\.toolbar\}/.test(home) ||
    /DotMatrixIcon name="settings" size=\{20\}/.test(home),
  "home model-fallback settings glyph size=20 (toolbar)"
);
assert(
  home.includes("!size-8") && home.includes("PromptInputSubmit"),
  "home submit path uses size-8 control"
);
// Model check: badge-scale 14, not 10
assert(
  !/DotMatrixIcon name="check" size=\{10\}/.test(home),
  "home has no model check size={10}"
);
assert(
  /DotMatrixIcon name="check" size=\{ICON_GLYPH\.badge\}/.test(home) ||
    /DotMatrixIcon name="check" size=\{14\}/.test(home),
  "home model/mode check uses size=14 (badge)"
);

// ── Prompt input toolbar/submit glyphs → 20 ─────────────────────────
assert(
  /DotMatrixIcon name="plus" size=\{ICON_GLYPH\.toolbar\}/.test(promptInput) ||
    /DotMatrixIcon name="plus" size=\{20\}/.test(promptInput),
  "prompt-input action-menu plus default glyph size=20"
);
assert(
  /size=\{ICON_GLYPH\.toolbar\}/.test(promptInput) ||
    /size=\{20\}/.test(promptInput),
  "prompt-input submit path uses toolbar glyph size"
);
// Menu row plus stays non-toolbar (12)
assert(
  /DotMatrixIcon name="plus" size=\{12\}/.test(promptInput),
  "prompt-input menu plus remains size={12} (not toolbar)"
);

// ── Speech mic in toolbar-ish control → 20 ──────────────────────────
assert(
  /DotMatrixIcon name="mic" size=\{ICON_GLYPH\.toolbar\}/.test(speechInput) ||
    /DotMatrixIcon name="mic" size=\{20\}/.test(speechInput),
  "speech-input mic glyph size=20 (toolbar)"
);

// ── Sidebar collapse: size-8 (not size-10) + glyph 20 ───────────────
assert(
  !sidebar.includes("size-10"),
  "sidebar has NO size-10 (collapse densified to size-8)"
);
assert(
  /flex size-8 items-center justify-center/.test(sidebar) &&
    (/panelLeft(Close|Open)" size=\{ICON_GLYPH\.toolbar\}/.test(sidebar) ||
      /panelLeft(Close|Open)" size=\{20\}/.test(sidebar)),
  "sidebar collapse is size-8 box + panel glyph 20"
);

// SidebarItem: control-toolbar 32 box + glyph 20 (size-8 on icon span, not outer button)
assert(
  sidebar.includes("flex size-8 shrink-0 items-center justify-center") &&
    (sidebar.includes("<Icon size={ICON_GLYPH.toolbar} />") ||
      sidebar.includes("<Icon size={20} />")),
  "SidebarItem icon wrapper size-8 + glyph toolbar 20"
);
assert(
  !/function SidebarItem[\s\S]{0,500}className=\{cn\(\s*"[^"]*size-8/.test(
    sidebar
  ),
  "SidebarItem outer button is not a size-8 square (w-full row)"
);
assert(
  !/function SidebarItem[\s\S]{0,500}\bgap-2\b/.test(sidebar) &&
    !/function SidebarItem[\s\S]{0,500}\bpx-3\b/.test(sidebar),
  "SidebarItem button has no gap-2 / px-3 (shell owns horizontal padding)"
);

// ── Attachment remove badge 18/14 ───────────────────────────────────
assert(
  attachments.includes("size-[18px]") &&
    (/DotMatrixIcon name="x" size=\{ICON_GLYPH\.badge\}/.test(attachments) ||
      /DotMatrixIcon name="x" size=\{14\}/.test(attachments)),
  "attachment remove badge 18px box + x glyph 14"
);

// ── Command palette close 32/20; row icons stay 16 ──────────────────
assert(
  palette.includes("size-8") &&
    (/DotMatrixIcon name="x" size=\{ICON_GLYPH\.toolbar\}/.test(palette) ||
      /DotMatrixIcon name="x" size=\{20\}/.test(palette)),
  "command palette close size-8 + x size 20"
);
assert(
  /DotMatrixIcon name="search" size=\{16\}/.test(palette) ||
    /DotMatrixIcon name="search" size=\{ICON_GLYPH\.inline\}/.test(palette),
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
