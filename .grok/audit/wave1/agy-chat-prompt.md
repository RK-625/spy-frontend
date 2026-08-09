# Audit Report: `chat-prompt` Domain (`src/components/chat/prompt/**`)

**Date:** 2026-08-08  
**Scope:** `src/components/chat/prompt/**` (16 files)  
**Agent:** Antigravity (LEAF Agent — No sub-agents spawned)  
**Mode:** Audit ONLY (Zero source code modifications)  
**Target Output:** `.grok/audit/wave1/agy-chat-prompt.md`  
**Reference Standards:** [`AGENTS.md`](file:///Users/apple/Development/Spy/spy-frontend/AGENTS.md), [`.grok/rules/code-preferences.md`](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md), recent git commit history (`git log -20`).

---

## 1. Executive Summary & Recent Refactoring Pattern Alignment

Analysis of recent commits (`git log -20`) reveals a clear, disciplined refactoring taste across `src/components/chat/prompt`:
* `1d4e5c5`: Tokenized attachment caps (`PROMPT_INPUT_*`), dropped document-wide `globalDrop` in favor of form-only drop, renamed `multiple` -> `isMultiple`, and migrated `FormEvent` -> `SubmitEvent`.
* `b574b06`: Converted `PromptInputWorkspace` into a zero-prop shell reading `sendMessage`, `status`, `stop`, and `messages` directly from `ChatContext`.
* `3398ba6`: Standardized submission handler naming (`submitAskOrChat` -> `handleSubmit`).
* `4a5b253`: Inlined submit logic into prompt shell, dropping `useChatSubmit` hook.
* `9684bc3`: Simplified `PromptInputProvider` context value and removed initial draft props.
* `3605c3b` & `686344b`: Eliminated dual/optional context hooks (`usePromptInputAttachments`, `useOptionalPromptInputContext`) in favor of strict `usePromptInputContext`.

The domain codebase is in **excellent shape**: zero TypeScript `any` types exist, file limits and attachment types are centralized in `PROMPT_INPUT_*` tokens, and circular barrel imports are completely absent.

However, this audit identified **5 actionable code smells** (4 High confidence, 1 Medium confidence) resulting from leftover exports, dead component primitives, unused imports, and non-descriptive naming.

---

## 2. Categorized Audit Findings

### A. HIGH Confidence Smells (≥ 75% Confidence)

#### 1. Unused `usePromptInputPrefs` Fallback Hook & `PromptInputPrefsReadonly` Type
* **Category:** Dual/Optional Hooks & Dead Exports
* **Confidence:** **95%**
* **File Location:** [`src/components/chat/prompt/shell/context.tsx#L97-L100`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/context.tsx#L97-L100) (also [`src/components/chat/prompt/index.ts#L6`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/index.ts#L6))
* **Description:**  
  `usePromptInputPrefs()` implements an optional fallback hook pattern (`value?.prefs ?? DEFAULT_PROMPT_PREFS`) that returns default preferences if called outside `PromptInputProvider`. Following commit `4a5b253` (which inlined submit handling into `PromptInputWorkspaceContent` and deleted `useChatSubmit`), `usePromptInputPrefs` is **never called anywhere** in the codebase. It violates the strict context rule and constitutes dead code.
* **Fix Recommended:** **YES** — Remove `usePromptInputPrefs()` and `PromptInputPrefsReadonly` from `shell/context.tsx` and stop exporting them in `index.ts`.

#### 2. Dead `title` Prop in `ModelSelectorContent`
* **Category:** Dead Props
* **Confidence:** **95%**
* **File Location:** [`src/components/chat/prompt/footer/model-selector.tsx#L39-L57`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/footer/model-selector.tsx#L39-L57)
* **Description:**  
  `ModelSelectorContent` accepts a `title` prop in `ModelSelectorContentProps` (defaulting to `"Model Selector"`). The `title` prop is destructured in the component arguments but is **never rendered or passed** to any child node or popover element.
* **Fix Recommended:** **YES** — Remove the unused `title` prop from `ModelSelectorContentProps` and `ModelSelectorContent`.

#### 3. Dead Primitive Components & Unused Imports in `model-selector.tsx`
* **Category:** Dead Component Exports / Barrel Bloat
* **Confidence:** **90%**
* **File Location:** [`src/components/chat/prompt/footer/model-selector.tsx#L59-L64,L98-L111`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/footer/model-selector.tsx#L59-L64#L98-L111)
* **Description:**  
  * `ModelSelectorDialog`, `ModelSelectorShortcut`, and `ModelSelectorSeparator` are exported primitives in `model-selector.tsx` and re-exported via `index.ts`, but are **never imported or used anywhere** in the project.
  * Line 17 imports `models` from `@/lib/models`, but `models` is never referenced inside `model-selector.tsx` (the model data array is passed in via props or mapped in `prompt-input.tsx`).
  * Lines 3, 9, 10 import `CommandDialog`, `CommandShortcut`, `CommandSeparator` from `@/components/ui`, which are only used by the dead components above.
* **Fix Recommended:** **YES** — Delete `ModelSelectorDialog`, `ModelSelectorShortcut`, and `ModelSelectorSeparator`, and clean up the 4 unused imports in `model-selector.tsx`.

#### 4. Dead Type Export `PromptInputWidgetResponse` in `pending-ask.tsx`
* **Category:** Dead Exports
* **Confidence:** **90%**
* **File Location:** [`src/components/chat/prompt/ask/pending-ask.tsx#L12-L17`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/ask/pending-ask.tsx#L12-L17)
* **Description:**  
  `PromptInputWidgetResponse` is exported from `pending-ask.tsx` and re-exported by `index.ts`, but is **never referenced anywhere** in `src/`.
* **Fix Recommended:** **YES** — Remove `PromptInputWidgetResponse`.

#### 5. Residual `Document` Type in `attachFileDrop` Parameter Union
* **Category:** `globalDrop` Cleanup Residual
* **Confidence:** **85%**
* **File Location:** [`src/components/chat/prompt/shell/prompt-input.tsx#L72-L75`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/prompt-input.tsx#L72-L75)
* **Description:**  
  `attachFileDrop` takes `target: Document | HTMLElement`. Following commit `1d4e5c5` which removed document-wide `globalDrop`, `attachFileDrop` is only ever called with `formRef.current` (`HTMLFormElement`). The `Document` type in the parameter signature is a leftover artifact of `globalDrop`.
* **Fix Recommended:** **YES** — Narrow `target: Document | HTMLElement` to `target: HTMLElement`.

---

### B. MED Confidence Smells (50% – 74% Confidence)

#### 6. Generic Naming (`isOpen`) in `attachment-strip.tsx`
* **Category:** Naming `isMultiple`/`handleSubmit` (Code Preferences - Functional Naming)
* **Confidence:** **70%**
* **File Location:** [`src/components/chat/prompt/attachments/attachment-strip.tsx#L63`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/attachments/attachment-strip.tsx#L63)
* **Description:**  
  [`.grok/rules/code-preferences.md`](file:///Users/apple/Development/Spy/spy-frontend/.grok/rules/code-preferences.md) section "Code Structure" explicitly mandates avoiding generic variable/function names like `isOpen` or `toggle`. In `attachment-strip.tsx`, the derived boolean for strip expansion is named `isOpen`.
* **Fix Recommended:** **NO** — `isOpen` is internal to `attachment-strip.tsx` and clearly reflects the collapsible container state (`isOpen = hasFiles || holdOpen`). Renaming to `isStripExpanded` is a minor cosmetic improvement.

---

### C. LOW Confidence Smells (< 50% Confidence)

#### 7. Explicit Prop Delegation in `PromptInputSubmit`
* **Category:** Zero-prop Shells / Isolation
* **Confidence:** **40%**
* **File Location:** [`src/components/chat/prompt/footer/submit.tsx#L17-L31`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/footer/submit.tsx#L17-L31)
* **Description:**  
  `PromptInputSubmit` accepts `status?: ChatStatus` and `onStop?: () => void` as props, and `PromptInputWorkspaceContent` passes them explicitly (`status={status}`, `onStop={stop}`). One could argue `PromptInputSubmit` should consume `useChatContext()` directly as a zero-prop sub-shell.
* **Fix Recommended:** **NO** — Keeping `PromptInputSubmit` as a pure presentation primitive accepting explicit props preserves reusability outside `ChatContext`.

---

## 3. Comprehensive Category Checklist

| Category | Status | Details |
|---|---|---|
| **Zero-prop shells** | **PASS** | `PromptInputWorkspace` & `PromptInputWorkspaceContent` are zero-prop shells (`() => JSX`). |
| **Dual/optional hooks** | **WARN** | `usePromptInputContext` throws correctly. `usePromptInputPrefs` is a dead optional fallback hook needing removal. |
| **SoT tokens (`PROMPT_INPUT_*`)** | **PASS** | All caps & file types centralized in `attachments/prompt-input-files.ts` (`PROMPT_INPUT_ACCEPT`, `PROMPT_INPUT_MAX_FILES`, `PROMPT_INPUT_ALLOW_MULTIPLE`, `PROMPT_INPUT_MAX_FILE_SIZE`). |
| **`SubmitEvent` vs `FormEvent`** | **PASS** | Form submit handlers correctly typed with `SubmitEvent` / `SubmitEventHandler`. `FormEvent` eliminated. |
| **`globalDrop` removal** | **WARN** | `globalDrop` prop & document listeners removed; `Document` type left in internal `attachFileDrop` helper signature. |
| **Naming `isMultiple`/`handleSubmit`** | **PASS** | `isMultiple` (boolean prop) and `handleSubmit` (form callback) follow strict naming rules. |
| **Barrels** | **PASS** | `index.ts` is a clean top-level barrel. No circular imports or root dual shims exist. |
| **Dead props / exports / imports** | **FAIL** | Found dead `title` prop, dead primitive components (`ModelSelectorDialog`, etc.), dead exported type `PromptInputWidgetResponse`, and unused imports in `model-selector.tsx`. |
| **`any` types** | **PASS** | Zero `any` types across all 16 prompt files. |
| **Isolation principle** | **PASS** | Modular sub-directories (`shell/`, `header/`, `body/`, `ask/`, `attachments/`, `footer/`) maintain strict topological dependency order. |

---

## 4. Suggested Fix Execution Plan (Wave 2 Cleanup)

When ready to apply fixes:
1. **`shell/context.tsx` & `index.ts`**: Delete `usePromptInputPrefs` and `PromptInputPrefsReadonly`.
2. **`footer/model-selector.tsx`**:
   - Remove `title` from `ModelSelectorContentProps` and `ModelSelectorContent`.
   - Remove `ModelSelectorDialog`, `ModelSelectorShortcut`, `ModelSelectorSeparator`.
   - Remove unused imports `models`, `CommandDialog`, `CommandShortcut`, `CommandSeparator`.
3. **`ask/pending-ask.tsx`**: Delete unused type `PromptInputWidgetResponse`.
4. **`shell/prompt-input.tsx`**: Change `attachFileDrop(target: Document | HTMLElement, ...)` signature to `target: HTMLElement`.
