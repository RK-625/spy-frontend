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
    // 422 CORRUPT_MESSAGES: do not treat as empty chat (would clobber on save).
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body.code) detail = ` ${body.code}`;
      else if (body.error) detail = ` ${body.error}`;
    } catch {
      // ignore body parse
    }
    throw new Error(`GET /api/chats failed: ${res.status}${detail}`);
  }
  const data = (await res.json()) as { chat: ChatWithMessages };
  return data.chat;
}

/** GET /api/chats — paginated meta list (optional cursor for next page). */
export async function listChats(
  cursor?: string | null,
): Promise<{ chats: ChatMeta[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  const res = await fetch(qs ? `/api/chats?${qs}` : "/api/chats");
  if (!res.ok) {
    throw new Error(`GET /api/chats failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    chats: ChatMeta[];
    nextCursor: string | null;
  };
  return {
    chats: data.chats,
    nextCursor: data.nextCursor ?? null,
  };
}

/** DELETE /api/chats?id= — idempotent; 204 even if the row was already gone. */
export async function deleteChat(chatId: string): Promise<void> {
  const res = await fetch(`/api/chats?id=${encodeURIComponent(chatId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`DELETE /api/chats failed: ${res.status}`);
  }
}
