import type { ModelMessage, UIMessage } from "ai";
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

export type ChatMeta = z.infer<typeof ChatMeta>;

/**
 * Detail chat: meta + two independent agent histories.
 *
 * messages = ChatAgent / user-facing conversation (UIMessage, UI-oriented).
 * graph_messages = GraphAgent / background graph-maintenance conversation
 * (ModelMessage — the graph agent speaks model messages natively).
 */
export type ChatWithMessages = ChatMeta & {
  messages: UIMessage[];
  graph_messages: ModelMessage[];
};

/**
 * A single chat message is an AI SDK UIMessage.
 * Both agent histories store UIMessage[] blobs.
 */
export type ChatMessage = UIMessage;
