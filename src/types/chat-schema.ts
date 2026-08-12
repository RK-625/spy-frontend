import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * Catalog fields for a chat row (SQLite `chats` meta columns).
 * Created on first user message only — no empty rows.
 * Timestamps are unix milliseconds.
 */
export const ChatMeta = z.object({
  id: z.string().describe("Unique chat id (client-minted; equals AI SDK Chat.id)"),
  title: z.string().describe("Display title (seeded from first user text)"),
  created_at: z.number().int().describe("Unix ms when the chat was created"),
  updated_at: z
    .number()
    .int()
    .describe("Unix ms last mutated (bump on each message append)"),
});

/** Inferred chat catalog row (value `ChatMeta` is the Zod schema). */
export type ChatMeta = z.infer<typeof ChatMeta>;

/**
 * Detail chat: meta + required messages.
 * Lazy load is Meta vs full (list/getChat → Meta; getChatWithMessages → ChatWithMessages).
 */
export type ChatWithMessages = ChatMeta & {
  messages: UIMessage[];
};

/**
 * A single chat message is an AI SDK UIMessage (stored inside messages_json).
 * No separate parts_json / ordinal row DTO.
 */
export type ChatMessage = UIMessage;
