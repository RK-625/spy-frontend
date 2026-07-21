# Ask-user-question widget (deprecated)

Snapshot of the chat **prompt-input** morph/widget implementation (options list,
pencil custom row, cascade exit, question header morph) removed from the live
chat shell so we can redesign it cleanly.

- `prompt-input-with-widget.tsx` — full former `prompt-input` with widget logic
- `widget-layout.ts` — `WIDGET` / `WIDGET_TYPE` tokens used by the morph UI

**Live path:** `src/components/chat/ai-elements/prompt-input.tsx` is chat-only
(header/body/textarea/footer tools, no askUserQuestion morph).

Do not import this into production routes without an intentional redesign.
