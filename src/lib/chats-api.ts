/**
 * Browser client for `/api/chats` (fetch only).
 * Server SQLite lives in `@/lib/chats` — do not import that from client.
 * Add future list/get/delete helpers here as open/hydrate lands.
 */
import type { UIMessage } from "ai";

/**
 * POST create-or-replace full transcript snapshot.
 * Missing row → insert (client chatId + title from first user text).
 * Existing → overwrite messages_json + updated_at.
 */
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
