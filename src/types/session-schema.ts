import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * Catalog fields for a chat session (SQLite `chat_sessions` meta columns).
 * Created on first user message only — no empty rows (S0).
 * Timestamps are unix milliseconds.
 */
export const ChatSessionMeta = z.object({
  id: z.string().describe("Unique session id"),
  title: z.string().describe("Display title (seeded from first user text)"),
  created_at: z.number().int().describe("Unix ms when the session was created"),
  updated_at: z
    .number()
    .int()
    .describe("Unix ms last mutated (bump on each message append)"),
});
/** Inferred session catalog row (value `ChatSessionMeta` is the Zod schema). */
export type ChatSessionMeta = z.infer<typeof ChatSessionMeta>;

/**
 * Detail session: meta + required messages.
 * Lazy load is Meta vs Session (list/getSession → Meta; getSessionWithMessages → Session).
 */
export type ChatSession = ChatSessionMeta & {
  messages: UIMessage[];
};

/**
 * A single chat message is an AI SDK UIMessage (stored inside messages_json).
 * No separate parts_json / ordinal row DTO.
 */
export type ChatMessage = UIMessage;
