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
// Schema SoT is ask-schema.ts (compat ask-user-question.ts shim removed).
const schemaRel = "src/ai/schemas/ask-schema.ts";
// Toolset SoT is tools/toolset.ts.
const toolsetRel = "src/ai/tools/toolset.ts";
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
assert(fs.existsSync(toolsetAbs), `${toolsetRel} exists`);

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
    /from\s+["']@\/ai\/schemas\/ask-schema["']/.test(src) ||
    /from\s+["']\.\.\/ai\/schemas\/ask-user-question["']/.test(src) ||
    /from\s+["']\.\.\/ai\/schemas\/ask-schema["']/.test(src),
  "lib imports schema module (not toolset)",
);
assert(
  !/from\s+["']@\/ai\/toolset["']/.test(src) &&
    !/from\s+["']@\/ai\/tools\/toolset["']/.test(src) &&
    !/from\s+["']\.\.\/ai\/toolset["']/.test(src) &&
    !/from\s+["']\.\.\/ai\/tools\/toolset["']/.test(src),
  "lib does not import toolset (Exa/server)",
);
assert(
  /from\s+["']@\/ai\/schemas\/ask-schema["']/.test(toolsetSrc) ||
    /from\s+["']\.\.\/schemas\/ask-schema["']/.test(toolsetSrc),
  "toolset imports schema from ask-schema SoT",
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
  dismissAskUserQuestion,
} from ${JSON.stringify(moduleAbs)};
import { Chat } from "@ai-sdk/react";
import { convertToModelMessages } from "ai";
import { saveChatMessages, waitForChatSaves } from "./src/lib/chats/api.ts";

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

// option mapping: whitespace-only labels skipped after trim; stable source-index ids.
// Schema rejects "" (z.string().min(1)); use "  " so safeParse succeeds then filter.
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
          options: [" A ", "  ", "B"],
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
  "inline option map skips whitespace-only, stable source index ids",
);

async function verifyDismissal() {
  const originalFetch = globalThis.fetch;
  let savedMessages;
  let modelRequests = 0;
  let rejectSave = false;
  let holdSave;
  let reportStarted;
  const writes = [];
  globalThis.fetch = async (url, init) => {
    if (url !== "/api/chats") {
      modelRequests += 1;
      throw new Error("Unexpected model request");
    }
    const { messages } = JSON.parse(init.body);
    writes.push(messages);
    if (reportStarted) { reportStarted(); reportStarted = undefined; }
    if (holdSave) { const held = holdSave; holdSave = undefined; await held; }
    if (rejectSave) { rejectSave = false; return new Response("", { status: 500 }); }
    savedMessages = JSON.parse(JSON.stringify(messages));
    return Response.json({ created: false });
  };
  const createPendingChat = (id) => new Chat({
    id,
    messages: [{ id: "ask", role: "assistant", parts: [{
      type: "tool-askUserQuestion", toolCallId: "dismiss-call",
      state: "input-available",
      input: { question: "Pick?", options: ["A", "B"], allowCustomInput: false },
    }] }],
  });
  try {
    const chat = createPendingChat("dismiss");
    const otherChat = createPendingChat("other");
    let releaseSave;
    holdSave = new Promise((resolve) => { releaseSave = resolve; });
    const started = new Promise((resolve) => { reportStarted = resolve; });
    const olderSave = saveChatMessages(chat.id, chat.messages);
    await started;
    const dismissal = dismissAskUserQuestion(chat, () => false);
    releaseSave();
    await Promise.all([olderSave, dismissal]);
    assertEq(writes.map((messages) => messages[0].parts[0].state),
      ["input-available", "output-available"], "older save precedes cancellation");
    assertEq(getPendingAskUserQuestion(chat.messages), null, "dismissal removes prompt");
    assertEq(chat.lastMessage.parts[0].output, { status: "cancelled" }, "SDK records cancellation output");
    assertTrue(getPendingAskUserQuestion(otherChat.messages) !== null, "other chat remains pending");
    const restored = new Chat({ id: chat.id, messages: savedMessages });
    assertEq(getPendingAskUserQuestion(restored.messages), null, "saved cancellation stays closed after hydration");
    const modelHistory = await convertToModelMessages(restored.messages, { ignoreIncompleteToolCalls: true });
    assertTrue(modelHistory.some((message) => message.role === "tool"), "cancellation becomes a model tool result");
    assertEq(modelRequests, 0, "dismissal never requests another model response");

    const retryChat = createPendingChat("retry");
    rejectSave = true;
    let rejected = false;
    try { await dismissAskUserQuestion(retryChat, () => false); } catch { rejected = true; }
    assertTrue(rejected, "save failure is reported");
    assertTrue(getPendingAskUserQuestion(retryChat.messages) !== null, "save failure restores pending question");
    await dismissAskUserQuestion(retryChat, () => false);
    assertEq(getPendingAskUserQuestion(retryChat.messages), null, "retry succeeds after failed save");

    const deletedChat = createPendingChat("deleted");
    const countBeforeDelete = writes.length;
    await dismissAskUserQuestion(deletedChat, () => true);
    assertEq(writes.length, countBeforeDelete, "deleted chat is never saved");

    let releaseFinalSave;
    holdSave = new Promise((resolve) => { releaseFinalSave = resolve; });
    const finalStarted = new Promise((resolve) => { reportStarted = resolve; });
    const finalSave = saveChatMessages(chat.id, chat.messages);
    await finalStarted;
    let drained = false;
    const drain = waitForChatSaves(chat.id).then(() => { drained = true; });
    await Promise.resolve();
    assertEq(drained, false, "deletion drain waits for an in-flight save");
    releaseFinalSave();
    await Promise.all([finalSave, drain]);
    assertEq(drained, true, "deletion can proceed after save finishes");
  } finally {
    globalThis.fetch = originalFetch;
  }
}
verifyDismissal().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

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
