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
    const body: unknown = await res.json().catch(() => null);
    const errMsg =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : res.statusText;
    throw new Error(`POST /api/chats failed: ${errMsg}`);
  }
}
