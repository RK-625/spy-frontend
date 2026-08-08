# Wave 1 audit — native-chat-prompt

**Scope:** `src/components/chat/prompt/**` (+ chat barrel only if re-export required; not needed)  
**Mode:** Audit then auto-fix only when confidence ≥ 75%  
**Date:** 2026-08-08  
**Worktree commit:** `d0f0a12`

## Inventory

```
prompt/
├── index.ts                    — domain barrel
├── ask/pending-ask.tsx         — pending-ask question + option leaves
├── attachments/
│   ├── prompt-input-files.ts   — PROMPT_INPUT_* SoT + filter helpers
│   ├── attachment-chip.tsx
│   └── attachment-strip.tsx
├── body/
│   ├── body.tsx                — pending-ask chrome + children
│   └── textarea.tsx
├── footer/
│   ├── footer.tsx / tools.tsx / button.tsx / submit.tsx
│   ├── speech-input.tsx
│   └── model-selector.tsx
├── header/header.tsx
└── shell/
    ├── context.tsx             — PromptInputProvider + draft/prefs
    └── prompt-input.tsx        — PromptInput form + PromptInputWorkspace
```

**Recent taste (followed):**
- `1d4e5c5` tokenize PROMPT_INPUT_* + SubmitEvent + drop globalDrop + isMultiple
- `b574b06` zero-prop PromptInputWorkspace
- `3398ba6` handleSubmit rename
- `4a5b253` inline useChatSubmit into shell
- `9684bc3` simplify provider props
- `3605c3b` / `686344b` drop dual/optional context hooks

**Already clean (no action):**
- No FormEvent / globalDrop remnants
- No dual optional context hooks
- PROMPT_INPUT_ACCEPT / MAX_FILES / MAX_FILE_SIZE / ALLOW_MULTIPLE SoT in place
- Inside-package relative imports; no self-barrel cycles
- No `any` types
- Morph widget not wired into production

---

## FIXED (≥75%)

| Smell | Confidence | Fix |
|-------|------------|-----|
| Dead `ModelSelectorDialog` / `Shortcut` / `Separator` + unused `CommandDialog` / `models` imports | 95% | Removed from `model-selector.tsx` |
| Unused `title` prop on `ModelSelectorContent` (never rendered) | 95% | Dropped prop |
| Dead `usePromptInputPrefs` + `PromptInputPrefsReadonly` (no consumers after submit inline) | 90% | Removed; kept `DEFAULT_PROMPT_PREFS` for provider |
| Dead `PromptInputWidgetResponse` type | 92% | Removed |
| `PromptInputWidgetOption` conflates morph “widget” with live pending-ask | 85% | Renamed → `PromptInputAskOption` |
| `isWidgetMode` same conflation | 88% | Renamed → `hasPendingAsk` |
| Generic `isOpen` in attachment strip | 88% | Renamed → `isStripExpanded` |
| Generic `toggleListening` | 80% | Renamed → `handleListeningToggle` |
| Generic `newSize` | 78% | Renamed → `resolvedSize` |
| Generic ModelItem prop `m` | 82% | Renamed → `modelEntry` |
| `attachFileDrop(Document \| HTMLElement)` after globalDrop removal | 92% | Narrowed to `HTMLElement` only |
| Validator registration indent / redundant property shorthand | 95% | Normalized |
| Split imports / module-header placement (button, submit, speech) | 90% | Header-first + merged dual package imports |
| `React.MouseEvent` / `React.SVGProps` without React value import | 80% | Named imports from `react` |

---

## DEFERRED (50–75%)

| Smell | Confidence | Why deferred |
|-------|------------|--------------|
| Magic motion durations (`0.2`, `0.15`) / `size-[18px]` / `w-[170px]` / `text-[11px]` not in CSS tokens | 60% | Recent SoT pattern targeted attachment *caps*, not all layout/motion numbers. Tokenizing would need design-token program + globals.css; risk of over-engineering one-offs. |
| `MOTION_DOM_PROP_KEYS` strip on form rest props | 55% | May still defend against motion wrapper spreads; no current caller passes them. Safe but not proven dead. |
| `AttachmentChip` video/audio/source-document branches vs product allowlist | 55% | Chip may be reused or forward-compat; not clearly dead product path. |
| Split `prompt-input.tsx` (form primitive vs workspace product) into two files | 65% | Large file; isolation would improve, but last wave intentionally co-located product shell. Needs explicit split task. |
| `PromptInput` still accepts optional accept/maxFiles/isMultiple while product always passes tokens | 70% | Primitive flexibility is intentional for deprecated/lab surfaces; product workspace is SoT-wired. |
| Workspace `handleSubmit` ignores `SubmitEvent` second arg from form `onSubmit` type | 60% | Assignable in TS; could tighten type to optional event or wrap — cosmetic. |
| Speech-input local `SpeechRecognition` interfaces vs lib.dom | 50% | Browser variance (webkit); not a smell of the recent cleanup class. |
| `submitUserMessage` intermediate `submitModel`/`submitMode` aliases | 55% | Readability only; not harmful. |

---

## DOUBTS (<50%)

| Item | Confidence | Note |
|------|------------|------|
| Whether `usePromptInputPrefs` should return later for settings / multi-surface | 40% | Removed as dead today; easy to reintroduce if a second surface needs prefs outside provider. |
| Whether model-selector thin wrappers should collapse further into direct Popover/Command at call site | 35% | Wrappers give stable names + sideOffset styling; not clearly over-engineered. |
| Whether attachment strip render-time `setState` pattern needs rewrite | 30% | Documented React pattern for derived open state; working. |
| Agents.md still references `prompt/prompt-input.tsx` (old flat path) | n/a | Docs out of write scope. |

---

## FILES_TOUCHED

- `src/components/chat/prompt/ask/pending-ask.tsx`
- `src/components/chat/prompt/attachments/attachment-strip.tsx`
- `src/components/chat/prompt/body/body.tsx`
- `src/components/chat/prompt/footer/button.tsx`
- `src/components/chat/prompt/footer/model-selector.tsx`
- `src/components/chat/prompt/footer/speech-input.tsx`
- `src/components/chat/prompt/footer/submit.tsx`
- `src/components/chat/prompt/shell/context.tsx`
- `src/components/chat/prompt/shell/prompt-input.tsx`

**Not touched:** `index.ts` (export * still correct), `chat/index.ts`, conversation/, shell/, contexts/, home, AI, graph.

---

## COMMITS

```
d0f0a12 refactor(chat): drop dead prompt exports and tighten names
```

Net: −36 lines (74 insertions / 110 deletions).

---

## Verification notes

- `npm run verify:widget-cleanup` — **pass**
- `npm run verify:pending-ask` — **env fail** (missing `zod` in worktree node_modules; unrelated to prompt edits)
- Local `tsc` / `eslint` binaries not present in this worktree (`node_modules` incomplete)
