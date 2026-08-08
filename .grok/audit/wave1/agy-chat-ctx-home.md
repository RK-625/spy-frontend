# Wave 1 Audit Report: Contexts, Hooks, Types & `/home` Domain

**Domain:** `contexts` + `hooks` + `types` + `app/home`  
**Target Repository:** `spy-frontend` (`/Users/apple/Development/Spy/spy-frontend`)  
**Auditor Mode:** Leaf Agent (Audit ONLY — zero code mutations performed)  
**Reference Guidelines:** `AGENTS.md` & `.grok/rules/code-preferences.md`

---

## 1. Executive Summary

A comprehensive, zero-mutation audit was performed across the **`contexts`**, **`hooks`**, **`types`**, and **`app/home`** modules, alongside related prompt and conversation components in `src/components/chat/`.

Overall, the codebase demonstrates strong adherence to TypeScript strictness—achieving a **0 explicit `any` type count** across all audited files. However, several architectural anti-patterns, dead code paths, soft default fallbacks, and stale declarations were identified that violate the **Isolation Principle** and **State Management Rules** set forth in `code-preferences.md` and `AGENTS.md`.

### Key Findings Summary:
1. **Wrapper Provider Leakage:** `ChatProvider` in [`src/contexts/ChatContext.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/contexts/ChatContext.tsx#L53) unilaterally embeds a UI component (`<TooltipProvider delayDuration={300}>`) inside a stream state data provider.
2. **Missing & Dead Hooks:** 
   - `src/hooks/use-chat-submit.ts` is documented in `AGENTS.md` (L164) as live code but **does not exist on disk**.
   - `useIsMobile()` in [`src/hooks/use-mobile.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/hooks/use-mobile.ts#L5) is exported with **0 usages** across the entire codebase (violates v1 Desktop-only constraint).
   - `useSteppedCycle()` in [`src/components/dotmatrix/core/hooks.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/components/dotmatrix/core/hooks.ts#L83) has **0 usages**.
   - `useReasoning()` and the entire [`src/components/chat/conversation/reasoning.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/conversation/reasoning.tsx#L39) module have **0 usages** (the production UI uses `ChainOfThought` in `chain-of-thought.tsx`).
   - `usePromptInputPrefs()` in [`src/components/chat/prompt/shell/context.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/context.tsx#L97) has **0 usages**.
3. **Soft Default Outside Provider:** `usePromptInputPrefs()` uses a soft default fallback (`value?.prefs ?? DEFAULT_PROMPT_PREFS`), masking missing context provider errors instead of strictly asserting context presence.
4. **Stale Context & Unused Exports:** `addToolOutput` on `ChatContextValue` in [`src/types/chat.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/types/chat.ts#L25) is instantiated in `ChatProvider` but **never consumed** anywhere. `PromptInputWidgetResponse` in [`pending-ask.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/ask/pending-ask.tsx#L12) is exported with **0 usages**.
5. **Prop Drilling & Render Bottlenecks in `/home`:** `pendingAsk` and `onOptionSelect` are drilled through multiple component layers in `prompt-input.tsx` -> `body.tsx` -> `pending-ask.tsx`. Inline IIFEs and un-memoized `EmptyState` render dynamically inside [`src/app/home/page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/home/page.tsx#L85-L192) message loops.
6. **Client `@/ai` Barrel Contamination Audit:** Client components (e.g., `src/lib/ask-user-question.ts`) correctly use deep imports (`@/ai/schemas/ask-schema`), preventing server dependencies (`falkordb`, `@google/genai`) from leaking into client bundles. However, root `@/ai/index.ts` lacks `"use server"` annotations.

---

## 2. Audit Findings Matrix

| Severity | Category | Location | Summary of Finding | Impact |
|---|---|---|---|---|
| **High** | Wrapper Provider | [`src/contexts/ChatContext.tsx:53`](file:///Users/apple/Development/Spy/spy-frontend/src/contexts/ChatContext.tsx#L53) | `ChatProvider` wraps children in UI `<TooltipProvider>` | Couples data context to UI hierarchy; violates isolation principle |
| **High** | Dead / Missing Hook | `src/hooks/use-chat-submit.ts` | Listed in `AGENTS.md` L164 but file missing from disk | Stale architectural documentation; confusion for developers |
| **Medium** | Dead Hook | [`src/hooks/use-mobile.ts:5`](file:///Users/apple/Development/Spy/spy-frontend/src/hooks/use-mobile.ts#L5) | `useIsMobile()` has 0 usages; Desktop-only app | Unnecessary bundle bloat & dead code in `src/hooks/` |
| **Medium** | Dead File & Hook | [`src/components/chat/conversation/reasoning.tsx:39`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/conversation/reasoning.tsx#L39) | `useReasoning()` & `Reasoning` component have 0 usages | Entire 237-line file is dead code (superseded by `chain-of-thought.tsx`) |
| **Medium** | Dead Hook | [`src/components/chat/prompt/shell/context.tsx:97`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/context.tsx#L97) | `usePromptInputPrefs()` exported with 0 usages | Dead code in prompt shell context module |
| **Low** | Soft Default | [`src/components/chat/prompt/shell/context.tsx:99`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/context.tsx#L99) | `usePromptInputPrefs` returns `value?.prefs ?? DEFAULT_PROMPT_PREFS` | Soft fallback masks missing provider errors outside `PromptInputProvider` |
| **Low** | Stale Context Value | [`src/types/chat.ts:25`](file:///Users/apple/Development/Spy/spy-frontend/src/types/chat.ts#L25) | `addToolOutput` in `ChatContextValue` has 0 consumers | Dead contract field; bloats context memoization in `ChatProvider` |
| **Low** | Dead Type Export | [`src/components/chat/prompt/ask/pending-ask.tsx:12`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/ask/pending-ask.tsx#L12) | `PromptInputWidgetResponse` exported with 0 usages | Orphaned TypeScript type definition |
| **Low** | Dead Hook | [`src/components/dotmatrix/core/hooks.ts:83`](file:///Users/apple/Development/Spy/spy-frontend/src/components/dotmatrix/core/hooks.ts#L83) | `useSteppedCycle()` exported with 0 usages | Unused helper hook in dot-matrix core |
| **Low** | Prop Drilling | [`src/components/chat/prompt/shell/prompt-input.tsx:470`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/prompt-input.tsx#L470) | `pendingAsk` & `onOptionSelect` drilled via props to `PromptInputBody` | Minor prop drill leftover in prompt shell |
| **Low** | Render Efficiency | [`src/app/home/page.tsx:85-192`](file:///Users/apple/Development/Spy/spy-frontend/src/app/home/page.tsx#L85-L192) | Inline IIFEs for CoT and Sources inside `messages.map` | Re-evaluates array filtering logic on every render frame |

---

## 3. Deep-Dive Analysis by Topic

### 3.1 Wrapper Providers & UI Contamination
In [`src/contexts/ChatContext.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/contexts/ChatContext.tsx#L53):
```tsx
return (
  <TooltipProvider delayDuration={300}>
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  </TooltipProvider>
);
```
- **Violation:** `ChatProvider` is defined as a stream-only chat state provider owning `useChat` transport and message status. Embedding Radix UI's `<TooltipProvider>` directly inside `ChatProvider` mixes UI presentation concerns into a core state context.
- **Recommendation:** Lift `<TooltipProvider>` up to `src/app/layout.tsx` or a dedicated root UI provider shell. `ChatProvider` should only return `<ChatContext.Provider value={value}>{children}</ChatContext.Provider>`.

### 3.2 Missing & Dead Hooks Audit

#### A. Missing Hook File (`src/hooks/use-chat-submit.ts`)
- **Finding:** `AGENTS.md` (Line 164) lists:
  `│   └── use-chat-submit.ts    — Bridges ChatContext stream + prompt prefs for send`
  However, `src/hooks/use-chat-submit.ts` **does not exist** in the repository. The submission bridge logic was refactored directly into `PromptInputWorkspaceContent` (`prompt-input.tsx:322`).
- **Recommendation:** Update `AGENTS.md` file tree documentation to remove `use-chat-submit.ts`.

#### B. Dead Hook `useIsMobile()` ([`src/hooks/use-mobile.ts`](file:///Users/apple/Development/Spy/spy-frontend/src/hooks/use-mobile.ts#L5))
- **Finding:** `useIsMobile()` is exported from `src/hooks/use-mobile.ts`. A full codebase grep reveals **0 imports** or invocations. Additionally, `AGENTS.md` explicitly lists: `"Desktop only for v1 (no responsive/mobile yet)"`.
- **Recommendation:** Delete `src/hooks/use-mobile.ts` or mark as deprecated if intended for v2.

#### C. Dead Hook & File `src/components/chat/conversation/reasoning.tsx`
- **Finding:** Contains `useReasoning()`, `Reasoning`, `ReasoningTrigger`, and `ReasoningContent`. Zero components in `/home` or the codebase import or render `Reasoning`. Production message rendering in [`src/app/home/page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/home/page.tsx#L93) uses `ChainOfThought` from [`chain-of-thought.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/conversation/chain-of-thought.tsx).
- **Recommendation:** Remove `reasoning.tsx` or archive to `src/deprecated/` if keeping for reference.

#### D. Dead Hook `usePromptInputPrefs()` ([`src/components/chat/prompt/shell/context.tsx:97`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/context.tsx#L97))
- **Finding:** `usePromptInputPrefs` is exported from `context.tsx`, but no component in the project imports it (`PromptInputWorkspaceContent` destructures `prefs` directly from `usePromptInputContext()`).
- **Recommendation:** Delete `usePromptInputPrefs()` to prevent soft-default masking.

#### E. Dead Hook `useSteppedCycle()` ([`src/components/dotmatrix/core/hooks.ts:83`](file:///Users/apple/Development/Spy/spy-frontend/src/components/dotmatrix/core/hooks.ts#L83))
- **Finding:** Exported from dotmatrix core hooks, but 0 consumers exist.
- **Recommendation:** Remove `useSteppedCycle` from `hooks.ts`.

---

### 3.3 Soft Defaults Outside Providers
In [`src/components/chat/prompt/shell/context.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/context.tsx#L97-L100):
```ts
export function usePromptInputPrefs(): PromptInputPrefsReadonly {
  const value = useContext(PromptInputContext);
  return value?.prefs ?? DEFAULT_PROMPT_PREFS;
}
```
- **Violation:** Providing a fallback (`DEFAULT_PROMPT_PREFS`) when context is `null` violates strict context assertion. Standard context hooks in this codebase (`useChatContext`, `usePromptInputContext`, `useReasoning`) throw explicit errors if rendered outside their required provider.
- **Recommendation:** Remove `usePromptInputPrefs` entirely as it is unused.

---

### 3.4 Stale `ChatContextValue` & Type Discrepancies

#### A. Stale `addToolOutput` Member
In [`src/types/chat.ts:25`](file:///Users/apple/Development/Spy/spy-frontend/src/types/chat.ts#L25) and [`src/contexts/ChatContext.tsx:39`](file:///Users/apple/Development/Spy/spy-frontend/src/contexts/ChatContext.tsx#L39):
```ts
export interface ChatContextValue {
  status: ChatStatus;
  messages: UIMessage[];
  clearMessages: () => void;
  error: Error | undefined;
  stop: () => void;
  sendMessage: UseChatApi["sendMessage"];
  addToolOutput: UseChatApi["addToolOutput"];
}
```
- **Finding:** `addToolOutput` is threaded into `ChatContextValue` and memoized in `ChatProvider`, but zero components consume `addToolOutput`.
- **Recommendation:** Remove `addToolOutput` from `ChatContextValue` and `ChatProvider` memoization.

#### B. Dead Type `PromptInputWidgetResponse`
In [`src/components/chat/prompt/ask/pending-ask.tsx:12`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/ask/pending-ask.tsx#L12):
```ts
export type PromptInputWidgetResponse = [
  {
    question: PendingAskUserQuestion["question"];
    response: PendingAskUserQuestion["options"][number];
  }
];
```
- **Finding:** Unused type export left over from earlier widget prototypes.
- **Recommendation:** Remove `PromptInputWidgetResponse`.

---

### 3.5 Prop Drilling Leftovers & Render Loop in `/home`

#### A. Prop Drilling in Prompt Input Shell
In [`src/components/chat/prompt/shell/prompt-input.tsx:470-475`](file:///Users/apple/Development/Spy/spy-frontend/src/components/chat/prompt/shell/prompt-input.tsx#L470-L475):
```tsx
<PromptInputBody
  pendingAsk={pendingAsk}
  onOptionSelect={(option) =>
    handleSubmit({ text: option.label, files: [] })
  }
>
  <PromptInputTextarea />
</PromptInputBody>
```
- **Finding:** `pendingAsk` is calculated inside `PromptInputWorkspaceContent` via `getPendingAskUserQuestion(messages)` and drilled down through `PromptInputBody` to `PromptInputQuestion` and `PromptInputOption`.
- **Recommendation:** Since `PromptInputWorkspaceContent` is already inside both `ChatProvider` and `PromptInputProvider`, `pendingAsk` state could either live on context or remain explicit props if kept strictly presentational.

#### B. Inline IIFEs in `src/app/home/page.tsx`
In [`src/app/home/page.tsx:85-170`](file:///Users/apple/Development/Spy/spy-frontend/src/app/home/page.tsx#L85-L170) and [`173-192`](file:///Users/apple/Development/Spy/spy-frontend/src/app/home/page.tsx#L173-L192):
```tsx
{(() => {
  const thoughtParts = message.parts.filter(...);
  if (thoughtParts.length === 0) return null;
  return <ChainOfThought ... />;
})()}
```
- **Finding:** Immediately Invoked Function Expressions (IIFEs) execute inline for every message during every render of `ChatWorkspace`.
- **Recommendation:** Extract message part rendering into sub-components (`MessageChainOfThought`, `MessageSources`) wrapped with `React.memo`.

---

### 3.6 Client `@/ai` Barrel Contamination Audit

- **Audit Query:** All imports matching `from "@/ai"` across client components, hooks, and contexts.
- **Findings:**
  - `src/app/api/chat/route.ts`: Imports `runAgent` from `@/ai` (Server API Route — valid).
  - `src/app/api/test-db/route.ts`: Imports `generateEmbedding` from `@/ai` (Server API Route — valid).
  - `src/lib/ask-user-question.ts`: Imports `askUserQuestionInputSchema` from `@/ai/schemas/ask-schema` (Deep import — valid & safe).
- **Result:** **PASS**. No client-side component imports directly from the root `@/ai` barrel. Client code uses deep subpath imports (`@/ai/schemas/ask-schema`), preventing Node.js server dependencies (`falkordb`, `@google/genai`) from leaking into client bundles.

---

### 3.7 TypeScript `any` Type Audit

- **Audit Query:** Grep for explicit `: any`, `<any`, and `as any` across `src/contexts`, `src/hooks`, `src/types`, `src/app/home`, and `src/components/chat/`.
- **Result:** **0 occurrences found**. The codebase strictly adheres to the `"never use 'any' type in Typescript"` rule specified in `.grok/rules/code-preferences.md`.

---

## 4. Alignment with `code-preferences.md` & `AGENTS.md`

| Guideline | Status | Notes |
|---|---|---|
| **Never use `any` type** | **COMPLIANT** | 0 instances of `any` across audited domain. |
| **Isolation Principle** | **NON-COMPLIANT** | `ChatProvider` violates isolation by wrapping UI `<TooltipProvider>`. |
| **No Over-Engineering / Dead Code** | **NON-COMPLIANT** | Dead hooks (`useIsMobile`, `useSteppedCycle`, `useReasoning`, `usePromptInputPrefs`) and missing file references (`use-chat-submit.ts`). |
| **Strict Context Enforcement** | **NON-COMPLIANT** | `usePromptInputPrefs` uses soft fallback instead of throwing error outside provider. |
| **Desktop-only v1 Constraint** | **COMPLIANT** | Desktop UI maintained; unused mobile hook (`useIsMobile`) flagged for cleanup. |

---

## 5. Recommended Remediation Plan (Wave 2 Tasks)

1. **Clean Up `ChatProvider` ([`ChatContext.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/contexts/ChatContext.tsx)):**
   - Remove `<TooltipProvider>` wrapper from `ChatProvider`.
   - Lift `<TooltipProvider>` to `layout.tsx` or root UI wrapper.
   - Remove unused `addToolOutput` from `ChatContextValue` and `ChatProvider`.

2. **Purge Dead Hooks & Files:**
   - Delete `src/hooks/use-mobile.ts`.
   - Remove `useSteppedCycle` from `src/components/dotmatrix/core/hooks.ts`.
   - Remove `usePromptInputPrefs` from `src/components/chat/prompt/shell/context.tsx`.
   - Delete or deprecate `src/components/chat/conversation/reasoning.tsx`.
   - Remove `PromptInputWidgetResponse` from `src/components/chat/prompt/ask/pending-ask.tsx`.

3. **Update Documentation (`AGENTS.md`):**
   - Remove stale reference to `use-chat-submit.ts` from file structure diagram.

4. **Refactor `/home` Render Efficiency ([`src/app/home/page.tsx`](file:///Users/apple/Development/Spy/spy-frontend/src/app/home/page.tsx)):**
   - Extract inline IIFEs (`thoughtParts`, `sources`) into memoized sub-components.
   - Move `EmptyState` out of the render function or wrap with `React.memo`.

---
*Report generated by Leaf Agent on 2026-08-08.*
