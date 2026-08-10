import { z } from "zod";

/**
 * Persisted chat session catalog row (SQLite `chat_sessions`).
 * Created on first user message only — no empty rows (S0).
 * Timestamps are unix milliseconds.
 */
export const ChatSession = z.object({
  id: z.string().describe("Unique session id"),
  title: z.string().describe("Display title (seeded from first user text)"),
  created_at: z.number().int().describe("Unix ms when the session was created"),
  updated_at: z
    .number()
    .int()
    .describe("Unix ms last mutated (bump on each message append)"),
});
/** Inferred chat session row (value `ChatSession` is the Zod schema). */
export type ChatSession = z.infer<typeof ChatSession>;

/**
 * Persisted chat message row (SQLite `chat_messages`).
 * `parts_json` is JSON.stringify of AI SDK UIMessage.parts.
 * Role is user | assistant in v1 (system possible later).
 */
export const ChatMessage = z.object({
  id: z.string().describe("Unique message id"),
  session_id: z.string().describe("Parent chat_sessions.id"),
  ordinal: z
    .number()
    .int()
    .describe("Stable 0-based order within the session"),
  role: z
    .enum(["user", "assistant", "system"])
    .describe("Message author role (user | assistant | system)"),
  parts_json: z
    .string()
    .describe("JSON string of UIMessage.parts for hydration"),
  created_at: z.number().int().describe("Unix ms when the message was stored"),
});
/** Inferred chat message row (value `ChatMessage` is the Zod schema). */
export type ChatMessage = z.infer<typeof ChatMessage>;
