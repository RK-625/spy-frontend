import type { PromptQuote } from "@/types/chat";
import { rangeToMarkdown } from "./selection-markdown";

export type MessageExcerpt = Omit<PromptQuote, "id">;

export interface MessageSelection extends MessageExcerpt {
  range: Range;
}

/**
 * Interactive chrome: a selection may span it (it is stripped), but may not start or end in it.
 * Links are content, including Streamdown's link-safety buttons.
 */
const selectionChrome =
  'button:not([data-streamdown="link"]), input, textarea, select, [role="button"], [contenteditable="true"], [data-selection-exclude]';

function textSurface(node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  if (element?.closest(selectionChrome)) return null;
  return element?.closest<HTMLElement>("[data-message-text]") ?? null;
}

/** Only one completed message's text may become a quote. */
export function readMessageSelection(
  selection: Selection | null,
  scope: HTMLElement,
): MessageSelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const start = textSurface(range.startContainer);
  const end = textSurface(range.endContainer);
  if (!start || !end || !scope.contains(start) || !scope.contains(end)) return null;
  const messageId = start.dataset.messageId;
  const role = start.dataset.messageRole;
  if (
    !messageId || messageId !== end.dataset.messageId ||
    (role !== "user" && role !== "assistant") ||
    start.dataset.messageComplete !== "true" || end.dataset.messageComplete !== "true"
  ) return null;
  const plainText = selection.toString();
  if (!plainText.trim()) return null;
  const text = rangeToMarkdown(range, start, selectionChrome);
  if (!text) return null;
  return { sourceMessageId: messageId, sourceRole: role, text, plainText, range: range.cloneRange() };
}
