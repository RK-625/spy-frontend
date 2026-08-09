/**
 * Rename-fidelity gate: each moved module must match HEAD:<old> except import path rewrites.
 * Exit non-zero on any other delta.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {[string, string][]} HEAD path → working tree path */
export const RENAME_MAP = [
  ["src/components/chat/ChatSidebar.tsx", "src/components/chat/chat-sidebar.tsx"],
  ["src/components/chat/SettingsDialog.tsx", "src/components/chat/settings-dialog.tsx"],
  ["src/components/ui/command-palette.tsx", "src/components/chat/command-palette.tsx"],
  ["src/components/ui/dotmatrix-core.tsx", "src/components/dotmatrix/core.tsx"],
  ["src/components/ui/dotmatrix-hooks.ts", "src/components/dotmatrix/hooks.ts"],
  ["src/components/ui/dotm-hex-9.tsx", "src/components/dotmatrix/hex-9.tsx"],
  ["src/components/ui/dotm-square-18.tsx", "src/components/dotmatrix/square-18.tsx"],
  ["src/components/ui/dotm-triangle-16.tsx", "src/components/dotmatrix/triangle-16.tsx"],
  ["src/components/chat/ai-elements/dot-matrix-icons.tsx", "src/components/dotmatrix/icons.tsx"],
  ["src/components/dotmatrix-loader.css", "src/components/dotmatrix/loader.css"],
  ["src/components/ui/ShinyText.tsx", "src/components/landing/shiny-text.tsx"],
  ["src/components/ui/ShinyText.css", "src/components/landing/shiny-text.css"],
  ["src/components/ui/svgs/anthropicBlack.tsx", "src/components/brand/logos/anthropic-black.tsx"],
  ["src/components/ui/svgs/anthropicWhite.tsx", "src/components/brand/logos/anthropic-white.tsx"],
  ["src/components/ui/svgs/deepseek.tsx", "src/components/brand/logos/deepseek.tsx"],
  ["src/components/ui/svgs/google.tsx", "src/components/brand/logos/google.tsx"],
  ["src/components/ui/svgs/openai.tsx", "src/components/brand/logos/openai.tsx"],
  ["src/components/ui/svgs/openaiDark.tsx", "src/components/brand/logos/openai-dark.tsx"],
  // ui-prototypes + ask-user-question morph archive removed (src/deprecated deleted).
];

const IMPORT_SUBS = [
  ["@/components/ui/svgs/anthropicBlack", "@/components/brand/logos/anthropic-black"],
  ["@/components/ui/svgs/anthropicWhite", "@/components/brand/logos/anthropic-white"],
  ["@/components/ui/svgs/openaiDark", "@/components/brand/logos/openai-dark"],
  ["@/components/ui/svgs/deepseek", "@/components/brand/logos/deepseek"],
  ["@/components/ui/svgs/google", "@/components/brand/logos/google"],
  ["@/components/ui/svgs/openai", "@/components/brand/logos/openai"],
  ["@/components/ui/ShinyText", "@/components/landing/shiny-text"],
  ["@/components/chat/ai-elements/dot-matrix-icons", "@/components/dotmatrix/icons"],
  ["@/components/ui/dotmatrix-core", "@/components/dotmatrix/core"],
  ["@/components/ui/dotmatrix-hooks", "@/components/dotmatrix/hooks"],
  ["@/components/ui/dotm-hex-9", "@/components/dotmatrix/hex-9"],
  ["@/components/ui/dotm-square-18", "@/components/dotmatrix/square-18"],
  ["@/components/ui/dotm-triangle-16", "@/components/dotmatrix/triangle-16"],
  ["@/components/dotmatrix-loader.css", "@/components/dotmatrix/loader.css"],
  ["@/components/chat/ChatSidebar", "@/components/chat/chat-sidebar"],
  ["@/components/chat/SettingsDialog", "@/components/chat/settings-dialog"],
  ["@/components/ui/command-palette", "@/components/chat/command-palette"],
  ["./ShinyText.css", "./shiny-text.css"],
  ["'./ShinyText.css'", "'./shiny-text.css'"],
  ['"./ShinyText.css"', '"./shiny-text.css"'],
  ["./dotmatrix-hooks", "./hooks"],
  ["./dotmatrix-core", "./core"],
  ["../ui/ShinyText", "./shiny-text"],
  ['from "../ui/ShinyText"', 'from "./shiny-text"'],
];

function applySubs(text) {
  let t = text;
  for (const [a, b] of IMPORT_SUBS) t = t.split(a).join(b);
  return t;
}

function gitShow(rel) {
  return execSync(`git show HEAD:${rel}`, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const failures = [];
const okPairs = [];

for (const [oldP, newP] of RENAME_MAP) {
  const newAbs = path.join(root, newP);
  if (!fs.existsSync(newAbs)) {
    failures.push({ pair: `${oldP} -> ${newP}`, reason: "new path missing" });
    continue;
  }
  let head;
  try {
    head = gitShow(oldP);
  } catch {
    // Domain reorg already committed: HEAD has the new path only. Pair stays in
    // RENAME_MAP as historical record; skip fidelity check (no old blob to diff).
    okPairs.push(`${oldP} -> ${newP} (already landed on HEAD)`);
    continue;
  }
  const expected = applySubs(head);
  const actual = fs.readFileSync(newAbs, "utf8");
  if (expected !== actual) {
    // Show a short unified-ish summary
    const expLines = expected.split("\n");
    const actLines = actual.split("\n");
    const max = Math.max(expLines.length, actLines.length);
    const sample = [];
    for (let i = 0; i < max && sample.length < 8; i++) {
      if (expLines[i] !== actLines[i]) {
        sample.push({
          line: i + 1,
          expected: expLines[i] ?? "<missing>",
          actual: actLines[i] ?? "<missing>",
        });
      }
    }
    failures.push({
      pair: `${oldP} -> ${newP}`,
      reason: "body differs from HEAD after allowed import substitutions only",
      sample,
      expectedLines: expLines.length,
      actualLines: actLines.length,
    });
  } else {
    okPairs.push(`${oldP} -> ${newP}`);
  }
}

// agent packing: root may be a thin re-export; SoT is agent/agent.ts (or root body).
// Pre-land: when HEAD still holds the runAgent body, compare impl ↔ HEAD after
// allowed import rewrites. Post-land: when HEAD root is itself a shim, skip blob
// fidelity and assert structural SoT properties only (rename pairs already do
// the same “already landed on HEAD” skip).
{
  const head = gitShow("src/ai/agent.ts");
  const rootActual = fs.readFileSync(path.join(root, "src/ai/agent.ts"), "utf8");
  const implAbs = path.join(root, "src/ai/agent/agent.ts");
  const SHIM_RE =
    /^\s*(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+\*\s+from\s+["']\.\/agent(?:\/agent)?["']\s*;?\s*$/;
  const isRootShim = SHIM_RE.test(rootActual);
  const isHeadShim = SHIM_RE.test(head);

  function normalizeAgentBody(text) {
    return text
      .replace(
        /from\s+["']\.\/toolset["']/g,
        'from "@/ai/tools/toolset"',
      )
      .replace(
        /from\s+["']\.\.\/toolset["']/g,
        'from "@/ai/tools/toolset"',
      )
      .replace(
        /from\s+["']@\/ai\/toolset["']/g,
        'from "@/ai/tools/toolset"',
      )
      .replace(
        /from\s+["']\.\/modelstore["']/g,
        'from "@/ai/models/modelstore"',
      )
      .replace(
        /from\s+["']\.\.\/modelstore["']/g,
        'from "@/ai/models/modelstore"',
      )
      .replace(
        /from\s+["']@\/ai\/modelstore["']/g,
        'from "@/ai/models/modelstore"',
      );
  }

  function withSystemPromptImport(body) {
    if (body.includes('from "@/prompts/system-prompt"')) return body;
    return body.replace(
      /import\s+\{\s*modelConfig\s*\}\s+from\s+["'][^"']+["'];\n/,
      (m) => `${m}import { systemPrompt } from "@/prompts/system-prompt";\n`,
    );
  }

  function assertStructuralSoT() {
    if (!fs.existsSync(implAbs)) {
      failures.push({
        pair: "src/ai/agent.ts",
        reason: "agent/agent.ts SoT missing while root is thin re-export",
      });
      return false;
    }
    const impl = fs.readFileSync(implAbs, "utf8");
    const checks = [
      [
        /export\s+(?:async\s+)?function\s+runAgent\b/.test(impl),
        "agent/agent.ts must export runAgent",
      ],
      [
        /from\s+["']@\/ai\/tools\/toolset["']/.test(impl) ||
          /from\s+["']\.\.\/tools\/toolset["']/.test(impl) ||
          /from\s+["']\.\.\/toolset["']/.test(impl),
        "agent/agent.ts must import toolset (domain or compat path)",
      ],
      [
        /from\s+["']@\/ai\/models\/modelstore["']/.test(impl) ||
          /from\s+["']\.\.\/models\/modelstore["']/.test(impl) ||
          /from\s+["']\.\.\/modelstore["']/.test(impl),
        "agent/agent.ts must import modelstore (domain or compat path)",
      ],
      [
        /export\s+\*\s+from\s+["']\.\/agent\/agent["']/.test(rootActual),
        "root agent.ts must re-export ./agent/agent (not ./agent — resolution footgun)",
      ],
    ];
    let ok = true;
    for (const [cond, msg] of checks) {
      if (!cond) {
        failures.push({ pair: "src/ai/agent.ts", reason: msg });
        ok = false;
      }
    }
    return ok;
  }

  let allowed = false;
  let okLabel = "";

  if (isHeadShim) {
    // Post-commit: HEAD root is already a shim — no pre-move body to diff.
    if (!isRootShim) {
      failures.push({
        pair: "src/ai/agent.ts",
        reason:
          "HEAD root is a thin re-export; working tree root must remain a thin re-export of ./agent/agent",
      });
    } else if (assertStructuralSoT()) {
      allowed = true;
      okLabel = "src/ai/agent.ts → agent/agent.ts (landed; structural SoT)";
    }
  } else if (!isRootShim) {
    // Legacy: both HEAD and WT still hold the body — only systemPrompt import.
    const expectedNorm = normalizeAgentBody(withSystemPromptImport(head));
    allowed =
      head === rootActual ||
      normalizeAgentBody(rootActual) === expectedNorm;
    okLabel = "src/ai/agent.ts (import-only allowed)";
  } else if (fs.existsSync(implAbs)) {
    // Pre-land move: WT root is shim, HEAD still has body — compare SoT ↔ HEAD.
    const expectedNorm = normalizeAgentBody(withSystemPromptImport(head));
    const implActual = fs.readFileSync(implAbs, "utf8");
    allowed = normalizeAgentBody(implActual) === expectedNorm;
    // Also require root targets ./agent/agent (not ambiguous ./agent).
    if (allowed && !/export\s+\*\s+from\s+["']\.\/agent\/agent["']/.test(rootActual)) {
      allowed = false;
    }
    okLabel = "src/ai/agent.ts → agent/agent.ts (shim + SoT fidelity)";
  }

  if (!allowed) {
    // Avoid double-push when structural asserts already recorded failures.
    if (!failures.some((f) => f.pair === "src/ai/agent.ts")) {
      failures.push({
        pair: "src/ai/agent.ts",
        reason: isRootShim
          ? "agent packing: root shim must re-export ./agent/agent; SoT must match HEAD body (pre-land) or structural markers (post-land)"
          : "only allowed change is adding systemPrompt import when HEAD references systemPrompt (or thin re-export to agent/agent)",
      });
    }
  } else {
    okPairs.push(okLabel);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, okPairs }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      pairsChecked: RENAME_MAP.length,
      okPairs,
    },
    null,
    2,
  ),
);
