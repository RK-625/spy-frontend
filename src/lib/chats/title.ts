/**
 * Chat-title rules shared by `/api/chats` routes (fallback, cap, first user text).
 */
import type { UIMessage } from "ai";

export const CHAT_TITLE_MAX_LEN = 80;
export const CHAT_TITLE_FALLBACK = "New chat";

function textFromMessage(message: UIMessage): string {
  const texts: string[] = [];
  for (const part of message.parts ?? []) {
    if (part.type === "text" && typeof part.text === "string") {
      texts.push(part.text);
    }
  }
  return texts.join(" ").trim();
}

/** First non-empty user text, or "" when the chat has none (e.g. files only). */
export function firstUserText(messages: UIMessage[]): string {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = textFromMessage(message);
    if (text.length > 0) return text;
  }
  return "";
}
