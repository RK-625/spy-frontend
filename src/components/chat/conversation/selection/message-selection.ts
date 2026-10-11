export interface MessageExcerpt {
  messageId: string;
  role: "user" | "assistant";
  text: string;
}

export interface MessageSelection extends MessageExcerpt {
  range: Range;
}

const excludedSelection =
  'button, a, input, textarea, select, [role="button"], [contenteditable="true"], [data-selection-exclude]';

function textSurface(node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  if (element?.closest(excludedSelection)) return null;
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
  if (range.cloneContents().querySelector(excludedSelection)) return null;
  const text = selection.toString();
  if (!text.trim()) return null;
  return { messageId, role, text, range: range.cloneRange() };
}

export function formatMessageExcerpt(excerpt: MessageExcerpt): string {
  const label = excerpt.role === "assistant" ? "Spy" : "You";
  return `> **${label}:**\n>\n${excerpt.text.replace(/\r\n?/g, "\n").split("\n").map((line) => `> ${line}`).join("\n")}`;
}
