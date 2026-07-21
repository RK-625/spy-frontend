#!/usr/bin/env node
/**
 * Verifies widget-mode removal from PromptInput (chat-only).
 * Run: node scripts/verify-widget-cleanup.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const promptInput = join(root, "src/components/chat/ai-elements/prompt-input.tsx");

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
];

let failed = false;

for (const rel of DELETED) {
  const p = join(root, rel);
  if (existsSync(p)) {
    console.error(`FAIL: deleted file still exists: ${rel}`);
    failed = true;
  }
}

const src = readFileSync(promptInput, "utf8");
for (const sym of FORBIDDEN) {
  if (src.includes(sym)) {
    console.error(`FAIL: prompt-input.tsx still contains "${sym}"`);
    failed = true;
  }
}

// askUserQuestion may remain in toolset for a future redesign; UI is deprecated.

if (failed) {
  process.exit(1);
}

console.log("OK: widget-mode cleanup verification passed");