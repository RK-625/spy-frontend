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
  ["src/app/ui-prototypes/page.tsx", "src/deprecated/ui-prototypes/app-page/page.tsx"],
  [
    "src/components/ui-prototypes/interactive-question-variants.tsx",
    "src/deprecated/ui-prototypes/components/interactive-question-variants.tsx",
  ],
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
  ["@/components/ui-prototypes/interactive-question-variants", "@/deprecated/ui-prototypes/components/interactive-question-variants"],
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
    failures.push({ pair: `${oldP} -> ${newP}`, reason: "HEAD path missing" });
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

// agent.ts: allow only systemPrompt import line addition
{
  const head = gitShow("src/ai/agent.ts");
  const actual = fs.readFileSync(path.join(root, "src/ai/agent.ts"), "utf8");
  const allowed =
    head === actual ||
    (actual.includes('import { systemPrompt } from "@/prompts/system-prompt";') &&
      applySubs(head).replace(
        'import { modelConfig } from "./modelstore";\n',
        'import { modelConfig } from "./modelstore";\nimport { systemPrompt } from "@/prompts/system-prompt";\n',
      ) === actual) ||
    (() => {
      // Normalize: HEAD body with import inserted after modelstore
      if (!head.includes("systemPrompt")) return false;
      const withImport = head.replace(
        'import { modelConfig } from "./modelstore";\n',
        'import { modelConfig } from "./modelstore";\nimport { systemPrompt } from "@/prompts/system-prompt";\n',
      );
      return withImport === actual;
    })();
  if (!allowed) {
    failures.push({
      pair: "src/ai/agent.ts",
      reason: "only allowed change is adding systemPrompt import when HEAD references systemPrompt",
    });
  } else {
    okPairs.push("src/ai/agent.ts (import-only allowed)");
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
