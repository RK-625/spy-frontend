#!/usr/bin/env node
/**
 * Verifies widget-mode removal from PromptInput (chat-only).
 * Scans domain SoT shell + body/ask (not only ai-elements shims).
 * Run: node scripts/verify-widget-cleanup.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const SCAN_TARGETS = [
  "src/components/chat/prompt/shell/prompt-input.tsx",
  "src/components/chat/prompt/body/body.tsx",
  "src/components/chat/prompt/ask/pending-ask.tsx",
  "src/components/chat/ai-elements/prompt-input.tsx",
];

const FORBIDDEN = [
  "askUserQuestionData",
  "setAskUserQuestionData",
  "isCascadeExiting",
  "AskUserQuestionData",
  "PromptInputQuestionHeader",
  "widget-layout",
  "WIDGET_TYPE",
  "WIDGET.",
  "handleOptionSelect",
  "flushSync",
];

const DELETED = [
  "src/components/chat/ai-elements/prompt-input-question-header.tsx",
  "src/lib/widget-layout.ts",
  "src/components/chat/prompt/prompt-input-controls.tsx",
  "src/components/chat/ai-elements/prompt-input-controls.tsx",
];

let failed = false;

for (const rel of DELETED) {
  const p = join(root, rel);
  if (existsSync(p)) {
    console.error(`FAIL: deleted file still exists: ${rel}`);
    failed = true;
  }
}

for (const rel of SCAN_TARGETS) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error(`FAIL: expected SoT/shim missing: ${rel}`);
    failed = true;
    continue;
  }
  const src = readFileSync(p, "utf8");
  for (const sym of FORBIDDEN) {
    if (src.includes(sym)) {
      console.error(`FAIL: ${rel} still contains "${sym}"`);
      failed = true;
    }
  }
}

// askUserQuestion may remain in toolset for a future redesign; UI is deprecated.

if (failed) {
  process.exit(1);
}

console.log("OK: widget-mode cleanup verification passed");
