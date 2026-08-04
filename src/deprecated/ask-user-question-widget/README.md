# Ask-user-question morph widget (deprecated)

Snapshot of the chat **prompt-input** **morph** implementation (cascade exit,
pencil custom row, question header morph, full `WIDGET` layout tokens) parked
so we can redesign that experiment cleanly.

- `prompt-input-with-widget.tsx` — full former morph-enabled `prompt-input`
- `widget-layout.ts` — `WIDGET` / `WIDGET_TYPE` tokens used by the morph UI

**Live path (non-morph pending-ask):** production SoT is
`src/components/chat/prompt/prompt-input.tsx` — `PromptInputBody` with
`pendingAsk` + `onOptionSelect` (`PromptInputQuestion` / `PromptInputOption`).
`/home` wires `getPendingAskUserQuestion` / `formatAskUserQuestionAnswer` from
`src/lib/ask-user-question.ts`. `ai-elements/prompt-input` is a compat re-export.
Morph UI is **not** live; simple option list **is**.

Do not import this morph snapshot into production routes without an intentional redesign.
