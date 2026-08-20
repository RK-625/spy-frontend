import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * CM6 chrome + markdown highlight, mapped only to existing design tokens.
 * Scoped outline reset: global `*:focus-visible` fights `.cm-editor`.
 */
export const editorTheme: Extension = [
  EditorView.theme(
    {
      "&": {
        backgroundColor: "transparent",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-code)",
        fontSize: "inherit",
        minHeight: "10rem",
      },
      "&.cm-focused, &:focus, &:focus-visible": {
        outline: "none",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-code)",
        lineHeight: "1.625",
        overflow: "auto",
      },
      ".cm-content": {
        backgroundColor: "var(--code-surface)",
        caretColor: "var(--color-accent)",
        fontFamily: "var(--font-code)",
        minHeight: "10rem",
        padding: "0",
      },
      ".cm-line": {
        padding: "0",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--color-accent)",
      },
      ".cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--accent-selection) !important",
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
        {
          backgroundColor: "var(--accent-selection)",
        },
      ".cm-searchMatch": {
        backgroundColor: "var(--accent-selection)",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        outline: "1px solid var(--color-accent)",
      },
      ".cm-selectionMatch": {
        backgroundColor: "var(--accent-selection)",
      },
      ".cm-panels": {
        backgroundColor: "var(--surface-elevated)",
        borderColor: "var(--border-subtle)",
        color: "var(--color-text-secondary)",
      },
      ".cm-panels .cm-textfield": {
        backgroundColor: "var(--code-surface)",
        border: "1px solid var(--border-subtle)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-code)",
        outline: "none",
      },
      ".cm-panels .cm-button": {
        background: "var(--surface-elevated)",
        border: "1px solid var(--border-subtle)",
        color: "var(--color-text-secondary)",
      },
      ".cm-panels .cm-button:active": {
        color: "var(--color-text-primary)",
      },
      ".cm-panel.cm-search label": {
        color: "var(--color-text-dim)",
      },
    },
    { dark: true },
  ),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.heading, color: "var(--color-accent)", fontWeight: "600" },
      { tag: tags.emphasis, fontStyle: "italic" },
      { tag: tags.strong, fontWeight: "600" },
      { tag: tags.strikethrough, textDecoration: "line-through" },
      { tag: tags.link, color: "var(--color-accent)" },
      { tag: tags.url, color: "var(--color-text-secondary)" },
      { tag: tags.monospace, color: "var(--color-text-primary)" },
      { tag: tags.quote, color: "var(--color-text-secondary)" },
      { tag: tags.comment, color: "var(--color-text-dim)" },
      { tag: tags.meta, color: "var(--color-text-dim)" },
      { tag: tags.processingInstruction, color: "var(--color-text-dim)" },
      { tag: tags.keyword, color: "var(--color-accent)" },
      { tag: tags.atom, color: "var(--color-text-secondary)" },
      { tag: tags.contentSeparator, color: "var(--color-text-dim)" },
      { tag: tags.list, color: "var(--color-text-secondary)" },
    ]),
  ),
];
