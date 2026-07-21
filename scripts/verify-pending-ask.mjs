/**
 * Structural + behavioral checks for last-message-only getPendingAskUserQuestion.
 *
 * Run: node scripts/verify-pending-ask.mjs
 * Or:  npm run verify:pending-ask
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRel = "src/lib/ask-user-question.ts";
const schemaRel = "src/ai/schemas/ask-user-question.ts";
const toolsetRel = "src/ai/toolset.ts";
const moduleAbs = path.join(root, moduleRel);
const schemaAbs = path.join(root, schemaRel);
const toolsetAbs = path.join(root, toolsetRel);

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

// ── Structural ──────────────────────────────────────────────────────
assert(fs.existsSync(moduleAbs), `${moduleRel} exists`);
assert(fs.existsSync(schemaAbs), `${schemaRel} exists`);

const src = fs.readFileSync(moduleAbs, "utf8");
const schemaSrc = fs.readFileSync(schemaAbs, "utf8");
const toolsetSrc = fs.readFileSync(toolsetAbs, "utf8");

assert(
  /export\s+const\s+askUserQuestionInputSchema\b/.test(schemaSrc),
  "schema exports askUserQuestionInputSchema",
);
assert(
  /export\s+type\s+AskUserQuestionInput\b/.test(schemaSrc),
  "schema exports type AskUserQuestionInput",
);
assert(
  /from\s+["']@\/ai\/schemas\/ask-user-question["']/.test(src) ||
    /from\s+["']\.\.\/ai\/schemas\/ask-user-question["']/.test(src),
  "lib imports schema module (not toolset)",
);
assert(
  !/from\s+["']@\/ai\/toolset["']/.test(src) &&
    !/from\s+["']\.\.\/ai\/toolset["']/.test(src),
  "lib does not import toolset (Exa/server)",
);
assert(
  /from\s+["']@\/ai\/schemas\/ask-user-question["']/.test(toolsetSrc),
  "toolset imports schema from @/ai/schemas/ask-user-question",
);
assert(
  /askUserQuestionInputSchema/.test(toolsetSrc) &&
    /inputSchema:\s*askUserQuestionInputSchema/.test(toolsetSrc),
  "toolset uses shared askUserQuestionInputSchema",
);
assert(
  !/const\s+askUserQuestionInputSchema\s*=\s*z\.object/.test(toolsetSrc),
  "toolset does not inline schema duplicate",
);
assert(
  /export\s+type\s+PendingAskUserQuestion\b/.test(src) ||
    /export\s+\{\s*type\s+PendingAskUserQuestion/.test(src),
  "exports type PendingAskUserQuestion",
);
assert(
  /export\s+function\s+getPendingAskUserQuestion\b/.test(src),
  "exports getPendingAskUserQuestion",
);
assert(
  /export\s+function\s+formatAskUserQuestionAnswer\b/.test(src),
  "exports formatAskUserQuestionAnswer",
);
assert(
  src.includes("tool-askUserQuestion"),
  "part type string tool-askUserQuestion present",
);
assert(src.includes("input-available"), "checks state input-available");
assert(
  /messages\.at\(\s*-1\s*\)/.test(src) || /at\(\s*-1\s*\)/.test(src),
  "last-message-only via messages.at(-1)",
);
assert(
  !/\bhasUserMessageAfter\b/.test(src),
  "no full-history hasUserMessageAfter helper",
);

const srcNoComments = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
assert(!/\bany\b/.test(srcNoComments), "no `any` type in lib source");

const schemaNoComments = schemaSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
assert(!/\bany\b/.test(schemaNoComments), "no `any` type in schema source");

// ── Behavioral (real module via tsx) ────────────────────────────────
const runner = `
import {
  formatAskUserQuestionAnswer,
  getPendingAskUserQuestion,
} from ${JSON.stringify(moduleAbs)};

function assertEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error("FAIL:", label, "\\n  expected:", e, "\\n  actual:  ", a);
    process.exitCode = 1;
  } else {
    console.log("OK:", label);
  }
}

function assertTrue(cond, label) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exitCode = 1;
  } else {
    console.log("OK:", label);
  }
}

// answer envelope
assertEq(
  formatAskUserQuestionAnswer({
    question: "  Where next?  ",
    answer: "  Vault  ",
  }),
  "Q: Where next?\\nA: Vault",
  "formatAskUserQuestionAnswer packs Q:/A: and trims",
);

// empty messages
assertEq(getPendingAskUserQuestion([]), null, "empty messages → null");

// last assistant streaming-only
assertEq(
  getPendingAskUserQuestion([
    {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-askUserQuestion",
          toolCallId: "tc-stream",
          state: "input-streaming",
          input: { question: "Pick one?", options: ["A", "B"], allowCustomInput: false },
        },
      ],
    },
  ]),
  null,
  "last assistant input-streaming only → null",
);

// last assistant input-available → hit
const pending = getPendingAskUserQuestion([
  {
    id: "a2",
    role: "assistant",
    parts: [
      {
        type: "tool-askUserQuestion",
        toolCallId: "tc-1",
        state: "input-available",
        input: {
          question: "  Where next?  ",
          options: ["Vault", "Bookmarks", "Empty"],
          allowCustomInput: false,
        },
      },
    ],
  },
]);
assertTrue(pending !== null, "last assistant input-available → non-null");
assertEq(
  pending && {
    toolCallId: pending.toolCallId,
    messageId: pending.messageId,
    question: pending.question,
    options: pending.options,
    allowCustomInput: pending.allowCustomInput,
  },
  {
    toolCallId: "tc-1",
    messageId: "a2",
    question: "Where next?",
    options: [
      { id: "opt-0", label: "Vault" },
      { id: "opt-1", label: "Bookmarks" },
      { id: "opt-2", label: "Empty" },
    ],
    allowCustomInput: false,
  },
  "input-available maps fields + trims question",
);

// last is user (prior assistant had ask) → null (answered)
assertEq(
  getPendingAskUserQuestion([
    {
      id: "a3",
      role: "assistant",
      parts: [
        {
          type: "tool-askUserQuestion",
          toolCallId: "tc-old",
          state: "input-available",
          input: {
            question: "Old?",
            options: ["Yes", "No"],
            allowCustomInput: true,
          },
        },
      ],
    },
    {
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "Yes" }],
    },
  ]),
  null,
  "last is user even if prior ask → null (answered)",
);

// Older pending + later assistant text-only: last has no ask → null (intentional last-only)
assertEq(
  getPendingAskUserQuestion([
    {
      id: "a-old",
      role: "assistant",
      parts: [
        {
          type: "tool-askUserQuestion",
          toolCallId: "tc-old",
          state: "input-available",
          input: {
            question: "First?",
            options: ["A", "B"],
            allowCustomInput: false,
          },
        },
      ],
    },
    {
      id: "a-later",
      role: "assistant",
      parts: [{ type: "text", text: "Continuing without a new ask." }],
    },
  ]),
  null,
  "older ask + later assistant text-only → null (last-message-only intentional)",
);

// last assistant with valid ask still wins when last is that ask
const multi = getPendingAskUserQuestion([
  {
    id: "a-old",
    role: "assistant",
    parts: [
      {
        type: "tool-askUserQuestion",
        toolCallId: "tc-old",
        state: "input-available",
        input: {
          question: "First?",
          options: ["A", "B"],
          allowCustomInput: false,
        },
      },
    ],
  },
  {
    id: "u-mid",
    role: "user",
    parts: [{ type: "text", text: "A" }],
  },
  {
    id: "a-new",
    role: "assistant",
    parts: [
      {
        type: "tool-askUserQuestion",
        toolCallId: "tc-new",
        state: "input-available",
        input: {
          question: "Second?",
          options: ["C", "D", "E"],
          allowCustomInput: true,
        },
      },
    ],
  },
]);
assertTrue(multi !== null && multi.toolCallId === "tc-new", "last message ask → tc-new");
assertTrue(multi !== null && multi.messageId === "a-new", "last messageId a-new");
assertTrue(multi !== null && multi.allowCustomInput === true, "last allowCustomInput true");

// prefer last matching part within last message
const dual = getPendingAskUserQuestion([
  {
    id: "a-dual",
    role: "assistant",
    parts: [
      {
        type: "tool-askUserQuestion",
        toolCallId: "tc-first",
        state: "input-available",
        input: {
          question: "First part?",
          options: ["A", "B"],
          allowCustomInput: false,
        },
      },
      {
        type: "tool-askUserQuestion",
        toolCallId: "tc-second",
        state: "input-available",
        input: {
          question: "Second part?",
          options: ["C", "D"],
          allowCustomInput: true,
        },
      },
    ],
  },
]);
assertTrue(
  dual !== null && dual.toolCallId === "tc-second",
  "prefers last matching part within last message",
);

// < 2 valid options after empty filter
assertEq(
  getPendingAskUserQuestion([
    {
      id: "a4",
      role: "assistant",
      parts: [
        {
          type: "tool-askUserQuestion",
          toolCallId: "tc-sparse",
          state: "input-available",
          input: {
            question: "Only one real?",
            options: ["  ", "Solo"],
            allowCustomInput: false,
          },
        },
      ],
    },
  ]),
  null,
  "fewer than 2 non-empty options → null",
);

// empty question
assertEq(
  getPendingAskUserQuestion([
    {
      id: "a5",
      role: "assistant",
      parts: [
        {
          type: "tool-askUserQuestion",
          toolCallId: "tc-q",
          state: "input-available",
          input: {
            question: "   ",
            options: ["A", "B"],
            allowCustomInput: false,
          },
        },
      ],
    },
  ]),
  null,
  "empty/whitespace question → null",
);

// option mapping: empty labels skipped, stable source-index ids
const mapped = getPendingAskUserQuestion([
  {
    id: "a-map",
    role: "assistant",
    parts: [
      {
        type: "tool-askUserQuestion",
        toolCallId: "tc-map",
        state: "input-available",
        input: {
          question: "Map?",
          options: [" A ", "", "B"],
          allowCustomInput: false,
        },
      },
    ],
  },
]);
assertEq(
  mapped && mapped.options,
  [
    { id: "opt-0", label: "A" },
    { id: "opt-2", label: "B" },
  ],
  "inline option map skips empty, stable source index ids",
);

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
`;

const result = spawnSync(
  "npx",
  ["--yes", "tsx", "-e", runner],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  failed += 1;
  console.error("FAIL: behavioral tests via tsx (exit", result.status, ")");
} else {
  console.log("OK: behavioral tests via tsx");
}

if (failed > 0) {
  console.error(`\n${failed} check group(s) failed`);
  process.exit(1);
}

console.log("\nAll pending-ask checks passed.");
