# Ask-user-question morph widget (deprecated)

Snapshot of the chat **prompt-input** **morph** implementation (cascade exit,
pencil custom row, question header morph, full `WIDGET` layout tokens) parked
so we can redesign that experiment cleanly.

- `prompt-input-with-widget.tsx` — full former morph-enabled `prompt-input`
- `widget-layout.ts` — `WIDGET` / `WIDGET_TYPE` tokens used by the morph UI

**Live path (non-morph pending-ask):** production SoT is
`@/components/chat/prompt` (`shell/prompt-input.tsx` + `body/` / `ask/pending-ask`).
`/home` wires `getPendingAskUserQuestion` / `formatAskUserQuestionAnswer` from
`src/lib/ask-user-question.ts`. Morph UI is **not** live; simple option list **is**.

Do not import this morph snapshot into production routes without an intentional redesign.
