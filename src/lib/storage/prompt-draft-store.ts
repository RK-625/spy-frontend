import {
  getClientDb,
  type PromptDraftRecord,
  type StoredDraftAttachment,
} from "./client-db";

export type { PromptDraftRecord, StoredDraftAttachment };

// Deleted chat UUIDs are never reused; block later puts from resurrecting the row.
const suppressedDeletedChatIds = new Set<string>();

/**
 * Retrieve a stored prompt draft for a specific chat ID.
 * Returns null if running in SSR, if IndexedDB is unavailable, or if no draft exists.
 */
export async function getPromptDraft(chatId: string): Promise<PromptDraftRecord | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const db = getClientDb();
    if (!db) {
      return null;
    }
    const record = await db.drafts.get(chatId);
    return record ?? null;
  } catch (error: unknown) {
    console.error(`[prompt-draft-store] Failed to get draft for chatId: ${chatId}`, error);
    return null;
  }
}

/**
 * Persist or update a prompt draft for a specific chat ID.
 * Safely no-ops if running in SSR or if IndexedDB is unavailable.
 */
export async function savePromptDraft(record: PromptDraftRecord): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (suppressedDeletedChatIds.has(record.chatId)) {
    return;
  }

  try {
    const db = getClientDb();
    if (!db) {
      return;
    }
    await db.drafts.put(record);
    // Compensating delete: an in-flight put started before suppress must not stick.
    if (suppressedDeletedChatIds.has(record.chatId)) {
      await db.drafts.delete(record.chatId);
    }
  } catch (error: unknown) {
    console.error(`[prompt-draft-store] Failed to save draft for chatId: ${record.chatId}`, error);
  }
}

/**
 * Delete a prompt draft for a specific chat ID.
 * Safely no-ops if running in SSR or if IndexedDB is unavailable.
 */
export async function deletePromptDraft(chatId: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const db = getClientDb();
    if (!db) {
      return;
    }
    await db.drafts.delete(chatId);
  } catch (error: unknown) {
    console.error(`[prompt-draft-store] Failed to delete draft for chatId: ${chatId}`, error);
  }
}

/**
 * Permanently drop a draft for a deleted chat and suppress later saves for that id.
 */
export async function discardDraftForDeletedChat(chatId: string): Promise<void> {
  suppressedDeletedChatIds.add(chatId);

  if (typeof window === "undefined") {
    return;
  }

  try {
    const db = getClientDb();
    if (!db) {
      return;
    }
    await db.drafts.delete(chatId);
  } catch (error: unknown) {
    console.error(
      `[prompt-draft-store] Failed to discard draft for deleted chatId: ${chatId}`,
      error,
    );
  }
}
