/**
 * Browser client for `/api/chats` (fetch only).
 * Server SQLite lives in `@/lib/chats/sqlite` — do not import that from client.
 */
import type { ModelMessage, UIMessage } from "ai";
import type { ChatMeta, ChatWithMessages } from "@/types/chat-schema";

/**
 * POST create-or-replace full transcript. `parentChatId` is fork-create only.
 * `created` → this save inserted the chat (first save of a new chat).
 */
export async function saveChatMessages(
  chatId: string,
  messages: UIMessage[],
  graphMessages?: ModelMessage[],
  parentChatId?: string,
): Promise<{ created: boolean }> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId,
      messages,
      graphMessages,
      ...(typeof parentChatId === "string" && parentChatId.length > 0
        ? { parentChatId }
        : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/chats failed: ${res.status}`);
  }
  const data = (await res.json()) as { created: boolean };
  return { created: data.created };
}

/** Non-OK GET /api/chats?id= — 404 missing, 422 corrupt, 500 other. Abort is not this. */
export class ChatFetchError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`GET /api/chats failed: ${status}${detail}`);
    this.name = "ChatFetchError";
    this.status = status;
  }
}

export function isChatNotFoundError(err: unknown): boolean {
  return err instanceof ChatFetchError && err.status === 404;
}

/** GET /api/chats?id= — meta + messages for cold open. */
export async function fetchChat(
  chatId: string,
  options?: { signal?: AbortSignal },
): Promise<ChatWithMessages> {
  const res = await fetch(`/api/chats?id=${encodeURIComponent(chatId)}`, {
    signal: options?.signal,
  });
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
    throw new ChatFetchError(res.status, detail);
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

/** PATCH /api/chats — rename; server trims + caps the title. 404 if the chat is gone. */
export async function renameChat(chatId: string, title: string): Promise<void> {
  const res = await fetch("/api/chats", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, title }),
  });
  if (!res.ok) {
    throw new Error(`PATCH /api/chats failed: ${res.status}`);
  }
}

/**
 * AI title for a new chat: POST /api/chats/[chatId]/title generates it, then
 * `renameChat` saves it. Resolves false when there was nothing to title
 * (no user text / empty model output) — the fallback title stays.
 */
export async function generateChatTitle(
  chatId: string,
  model: string,
): Promise<boolean> {
  const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/chats/[chatId]/title failed: ${res.status}`);
  }
  if (res.status === 204) return false;
  const data = (await res.json()) as { title: string };
  await renameChat(chatId, data.title);
  return true;
}
