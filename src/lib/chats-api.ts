/**
 * Browser client for `/api/chats` (fetch only).
 * Server SQLite lives in `@/lib/chats` — do not import that from client.
 */
import type { UIMessage } from "ai";
import type { ChatMeta, ChatWithMessages } from "@/types/chat-schema";

/** POST create-or-replace full transcript. */
export async function saveChatMessages(
  chatId: string,
  messages: UIMessage[],
): Promise<void> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, messages }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/chats failed: ${res.status}`);
  }
}

/** GET /api/chats?id= — meta + messages for cold open. */
export async function fetchChat(chatId: string): Promise<ChatWithMessages> {
  const res = await fetch(`/api/chats?id=${encodeURIComponent(chatId)}`);
  if (!res.ok) {
    throw new Error(`GET /api/chats failed: ${res.status}`);
  }
  const data = (await res.json()) as { chat: ChatWithMessages };
  return data.chat;
}

/** GET /api/chats — paginated meta list (first page). */
export async function listChats(): Promise<ChatMeta[]> {
  const res = await fetch("/api/chats");
  if (!res.ok) {
    throw new Error(`GET /api/chats failed: ${res.status}`);
  }
  const data = (await res.json()) as { chats: ChatMeta[] };
  return data.chats;
}
