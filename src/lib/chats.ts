/**
 * Node / API-route only — better-sqlite3 native binding.
 * Do not import from client components or Edge runtime.
 * (server-only package not installed; enforce by import graph.)
 *
 * Storage model: ONE table `chats` with `messages_json` holding the full
 * UIMessage[] blob. No separate messages table.
 *
 * Id policy: client mints the chat id at Chat registry insert; first persist
 * inserts the SQLite row with that same id (no server re-mint / rebind).
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { UIMessage } from "ai";
import Database from "better-sqlite3";
import { ChatMeta, type ChatWithMessages } from "@/types/chat-schema";

/**
 * Local SQLite file for chat catalog + transcripts.
 * Override with CHATS_DB_PATH. Parent dir is ensured on open.
 */
const CHATS_DB_PATH = resolve(process.env.CHATS_DB_PATH ?? ".data/chats.db");

/** Process-singleton; null until first successful open (failed open stays null for retry). */
let chatsDb: Database.Database | null = null;

// ---------------------------------------------------------------------------
// List pagination types
// ---------------------------------------------------------------------------

export type ChatListCursor = { updated_at: number; id: string };

export type ListChatsParams = {
  limit: number;
  cursor?: ChatListCursor | null;
};

export type ListChatsResult = {
  chats: ChatMeta[];
  nextCursor: ChatListCursor | null;
};

/**
 * Product create always has first message (title derived by API).
 * `id` is client-minted (same as AI SDK Chat.id / client Map key).
 */
export type CreateChatRecordInput = {
  id: string;
  title: string;
  messages: UIMessage[];
};

// ---------------------------------------------------------------------------
// DB open / schema
// ---------------------------------------------------------------------------

function ensureChatsDataDir(): string {
  const dir = dirname(CHATS_DB_PATH);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Idempotent schema setup — safe on every process open.
 * CREATE IF NOT EXISTS only; never DROP (persistence must survive restarts).
 * Schema changes later go through real migrations, not wipe-on-open.
 */
export function setupChatsDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      messages_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_chats_updated_at
      ON chats (updated_at DESC);
  `);
}

/**
 * Process-singleton open. Failed opens leave the singleton null so the next
 * call can retry (do not cache a broken instance forever).
 */
export function getChatsDb(): Database.Database {
  if (chatsDb) {
    return chatsDb;
  }

  try {
    ensureChatsDataDir();
    const instance = new Database(CHATS_DB_PATH);
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    setupChatsDb(instance);
    chatsDb = instance;
    console.log(`Chats SQLite open at ${CHATS_DB_PATH}`);
    return instance;
  } catch (error: unknown) {
    chatsDb = null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Row / messages parsers
// ---------------------------------------------------------------------------

export type ParseMessagesFailReason = "invalid_json" | "not_array";

export type ParseMessagesResult =
  | { ok: true; messages: UIMessage[] }
  | { ok: false; reason: ParseMessagesFailReason };

/** Thrown when a chats row exists but messages_json cannot be read safely. */
export class CorruptChatError extends Error {
  readonly chatId: string;
  readonly reason: ParseMessagesFailReason;

  constructor(chatId: string, reason: ParseMessagesFailReason) {
    super(`Corrupt chat transcript: ${chatId} (${reason})`);
    this.name = "CorruptChatError";
    this.chatId = chatId;
    this.reason = reason;
  }
}

function parseMetaRow(row: unknown): ChatMeta | null {
  const result = ChatMeta.safeParse(row);
  if (!result.success) {
    console.error("Invalid chats meta row", result.error.flatten());
    return null;
  }
  return result.data;
}

/**
 * Parse messages_json blob. Never fail-soft to [] — empty success would let
 * hydrate + full snapshot overwrite destroy a corrupt-but-recoverable row.
 */
function parseMessagesJson(messagesJson: string): ParseMessagesResult {
  try {
    const parsed: unknown = JSON.parse(messagesJson);
    if (!Array.isArray(parsed)) {
      console.error("messages_json is not an array");
      return { ok: false, reason: "not_array" };
    }
    return { ok: true, messages: parsed as UIMessage[] };
  } catch (error: unknown) {
    console.error("Failed to parse messages_json", error);
    return { ok: false, reason: "invalid_json" };
  }
}

// ---------------------------------------------------------------------------
// Chat CRUD (one-table)
// ---------------------------------------------------------------------------

/**
 * Paginated Recents list: meta only (no messages_json parse).
 * Newest first (updated_at DESC, id DESC). Cursor: strictly older than (updated_at, id).
 */
export function listChats(params: ListChatsParams): ListChatsResult {
  const db = getChatsDb();
  const { limit } = params;
  const cursor = params.cursor ?? null;


  type MetaRow = {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
  };

  const rows: MetaRow[] = cursor
    ? (db
        .prepare(
          `SELECT id, title, created_at, updated_at
           FROM chats
           WHERE updated_at < ?
              OR (updated_at = ? AND id < ?)
           ORDER BY updated_at DESC, id DESC
           LIMIT ?`,
        )
        .all(
          cursor.updated_at,
          cursor.updated_at,
          cursor.id,
          limit,
        ) as MetaRow[])
    : (db
        .prepare(
          `SELECT id, title, created_at, updated_at
           FROM chats
           ORDER BY updated_at DESC, id DESC
           LIMIT ?`,
        )
        .all(limit) as MetaRow[]);

  const chats: ChatMeta[] = [];
  for (const row of rows) {
    const parsed = parseMetaRow(row);
    if (parsed) chats.push(parsed);
  }

  const nextCursor: ChatListCursor | null =
    chats.length === limit
      ? {
          updated_at: chats[chats.length - 1].updated_at,
          id: chats[chats.length - 1].id,
        }
      : null;

  return { chats, nextCursor };
}

/**
 * Insert a new chats row with the first message(s).
 * Id is client-provided (same UUID as AI SDK Chat.id).
 */
export function createChatRecord(
  input: CreateChatRecordInput,
): ChatWithMessages {
  const db = getChatsDb();
  const now = Date.now();
  const chat: ChatWithMessages = {
    id: input.id,
    title: input.title,
    created_at: now,
    updated_at: now,
    messages: input.messages,
  };

  db.prepare(
    `INSERT INTO chats (id, title, created_at, updated_at, messages_json)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    chat.id,
    chat.title,
    chat.created_at,
    chat.updated_at,
    JSON.stringify(chat.messages),
  );

  return chat;
}

/** Meta only — does not read messages_json. */
export function getChat(chatId: string): ChatMeta | null {
  const db = getChatsDb();
  const row = db
    .prepare(
      `SELECT id, title, created_at, updated_at
       FROM chats
       WHERE id = ?`,
    )
    .get(chatId);
  if (!row) return null;
  return parseMetaRow(row);
}

/**
 * Meta + parsed messages_json nested on ChatWithMessages.
 * Missing row → null. Corrupt messages_json → CorruptChatError (never empty []).
 */
export function getChatWithMessages(chatId: string): ChatWithMessages | null {
  const db = getChatsDb();
  const row = db
    .prepare(
      `SELECT id, title, created_at, updated_at, messages_json
       FROM chats
       WHERE id = ?`,
    )
    .get(chatId) as
    | {
        id: string;
        title: string;
        created_at: number;
        updated_at: number;
        messages_json: string;
      }
    | undefined;

  if (!row) return null;

  const meta = parseMetaRow({
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
  if (!meta) return null;

  const parsed = parseMessagesJson(row.messages_json);
  if (!parsed.ok) {
    throw new CorruptChatError(chatId, parsed.reason);
  }

  return {
    ...meta,
    messages: parsed.messages,
  };
}

/**
 * Full overwrite of messages_json (blob snapshot of client Chat.messages).
 * Title is unchanged. Bumps updated_at.
 * Live UI stays on AI SDK Chat; this is durable store only.
 * Refuses overwrite if the existing blob is unreadable (blocks silent clobber).
 */
export function replaceChatMessages(
  chatId: string,
  messages: UIMessage[],
): void {
  const db = getChatsDb();
  const existing = db
    .prepare(`SELECT messages_json FROM chats WHERE id = ?`)
    .get(chatId) as { messages_json: string } | undefined;

  if (!existing) {
    throw new Error(`replaceChatMessages: chat not found: ${chatId}`);
  }

  const parsed = parseMessagesJson(existing.messages_json);
  if (!parsed.ok) {
    throw new CorruptChatError(chatId, parsed.reason);
  }

  const now = Date.now();
  db.prepare(
    `UPDATE chats
     SET messages_json = ?, updated_at = ?
     WHERE id = ?`,
  ).run(JSON.stringify(messages), now, chatId);
}

/**
 * Create-or-replace durable transcript for a client-minted chatId.
 * - Missing row → insert (title only on create).
 * - Existing row → replace messages_json + updated_at (title kept).
 */
export function upsertChatMessages(input: {
  id: string;
  title: string;
  messages: UIMessage[];
}): ChatMeta {
  const existing = getChat(input.id);
  if (existing) {
    replaceChatMessages(input.id, input.messages);
    const meta = getChat(input.id);
    if (!meta) {
      throw new Error(`upsertChatMessages: chat missing after replace: ${input.id}`);
    }
    return meta;
  }

  createChatRecord({
    id: input.id,
    title: input.title,
    messages: input.messages,
  });
  const meta = getChat(input.id);
  if (!meta) {
    throw new Error(`upsertChatMessages: chat missing after create: ${input.id}`);
  }
  return meta;
}
