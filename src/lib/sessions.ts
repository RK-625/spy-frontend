/**
 * Node / API-route only — better-sqlite3 native binding.
 * Do not import from client components or Edge runtime.
 * (server-only package not installed; enforce by import graph.)
 *
 * Storage model (Turn 3.5): ONE table `chat_sessions` with `messages_json`
 * holding the full UIMessage[] blob. No `chat_messages` table.
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { UIMessage } from "ai";
import Database from "better-sqlite3";
import {
  ChatSessionMeta,
  type ChatSession,
} from "@/types/session-schema";

/**
 * Local SQLite file for chat session catalog + transcripts.
 * Override with SESSIONS_DB_PATH. Parent dir is ensured on open.
 */
const SESSIONS_DB_PATH = resolve(
  process.env.SESSIONS_DB_PATH ?? ".data/sessions.db",
);

/** Process-singleton; null until first successful open (failed open stays null for retry). */
let sessionsDb: Database.Database | null = null;

// ---------------------------------------------------------------------------
// List pagination types
// ---------------------------------------------------------------------------

export type SessionListCursor = { updated_at: number; id: string };

export type ListSessionsParams = {
  limit: number;
  cursor?: SessionListCursor | null;
};

export type ListSessionsResult = {
  sessions: ChatSessionMeta[];
  nextCursor: SessionListCursor | null;
};

/** Product create always has first message (title derived by API). */
export type CreateSessionInput = {
  title: string;
  messages: UIMessage[];
};

// ---------------------------------------------------------------------------
// DB open / schema
// ---------------------------------------------------------------------------

function ensureSessionsDataDir(): string {
  const dir = dirname(SESSIONS_DB_PATH);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Early-draft schema setup (wipe-friendly).
 * Drops Turn 2/3 dual-table layout if present, then creates ONE `chat_sessions`
 * table with nested `messages_json` (full UIMessage[] blob). No production data
 * to migrate — safe to recreate on open for this phase.
 */
export function setupSessionsDb(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS chat_sessions;

    CREATE TABLE chat_sessions (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      messages_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX idx_chat_sessions_updated_at
      ON chat_sessions (updated_at DESC);
  `);
}

/**
 * Process-singleton open. Failed opens leave the singleton null so the next
 * call can retry (do not cache a broken instance forever).
 */
export function getSessionsDb(): Database.Database {
  if (sessionsDb) {
    return sessionsDb;
  }

  try {
    ensureSessionsDataDir();
    const instance = new Database(SESSIONS_DB_PATH);
    instance.pragma("journal_mode = WAL");
    instance.pragma("foreign_keys = ON");
    setupSessionsDb(instance);
    sessionsDb = instance;
    console.log(`Sessions SQLite open at ${SESSIONS_DB_PATH}`);
    return instance;
  } catch (error: unknown) {
    sessionsDb = null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Row / messages parsers
// ---------------------------------------------------------------------------

function parseMetaRow(row: unknown): ChatSessionMeta | null {
  const result = ChatSessionMeta.safeParse(row);
  if (!result.success) {
    console.error("Invalid chat_sessions meta row", result.error.flatten());
    return null;
  }
  return result.data;
}

/** Fail soft: corrupt blob → empty array (logged). */
function parseMessagesJson(messagesJson: string): UIMessage[] {
  try {
    const parsed: unknown = JSON.parse(messagesJson);
    if (!Array.isArray(parsed)) {
      console.error("messages_json is not an array");
      return [];
    }
    return parsed as UIMessage[];
  } catch (error: unknown) {
    console.error("Failed to parse messages_json", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Session CRUD (one-table)
// ---------------------------------------------------------------------------

/**
 * Paginated Recents list: meta only (no messages_json parse).
 * Newest first (updated_at DESC, id DESC). Cursor: strictly older than (updated_at, id).
 */
export function listSessions(params: ListSessionsParams): ListSessionsResult {
  const db = getSessionsDb();
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
           FROM chat_sessions
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
           FROM chat_sessions
           ORDER BY updated_at DESC, id DESC
           LIMIT ?`,
        )
        .all(limit) as MetaRow[]);

  const sessions: ChatSessionMeta[] = [];
  for (const row of rows) {
    const parsed = parseMetaRow(row);
    if (parsed) sessions.push(parsed);
  }

  const nextCursor: SessionListCursor | null =
    sessions.length === limit
      ? {
          updated_at: sessions[sessions.length - 1].updated_at,
          id: sessions[sessions.length - 1].id,
        }
      : null;

  return { sessions, nextCursor };
}

/**
 * Insert a new chat_sessions row with the first message(s).
 * id / timestamps always server-minted (no client overrides).
 */
export function createSession(input: CreateSessionInput): ChatSession {
  const db = getSessionsDb();
  const now = Date.now();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title: input.title,
    created_at: now,
    updated_at: now,
    messages: input.messages,
  };

  db.prepare(
    `INSERT INTO chat_sessions (id, title, created_at, updated_at, messages_json)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    session.id,
    session.title,
    session.created_at,
    session.updated_at,
    JSON.stringify(session.messages),
  );

  return session;
}

/** Meta only — does not read messages_json. */
export function getSession(sessionId: string): ChatSessionMeta | null {
  const db = getSessionsDb();
  const row = db
    .prepare(
      `SELECT id, title, created_at, updated_at
       FROM chat_sessions
       WHERE id = ?`,
    )
    .get(sessionId);
  if (!row) return null;
  return parseMetaRow(row);
}

/** Meta + parsed messages_json nested on ChatSession. */
export function getSessionWithMessages(
  sessionId: string,
): ChatSession | null {
  const db = getSessionsDb();
  const row = db
    .prepare(
      `SELECT id, title, created_at, updated_at, messages_json
       FROM chat_sessions
       WHERE id = ?`,
    )
    .get(sessionId) as
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

  return {
    ...meta,
    messages: parseMessagesJson(row.messages_json),
  };
}

/**
 * Persist one finished UIMessage into the session blob (read → push → write).
 * Fire-and-forget from the product path: does not return session state.
 *
 * Live chat UI is owned by AI SDK `useChat` after the first hydrate.
 * - Hydrate once: `getSessionWithMessages` → `useChat({ messages })` (or registry entry).
 * - While chatting: SDK holds message/stream state in memory.
 * - On finish: server/client calls `appendMessage` only to durable-store — no need to
 *   feed the return value back into React (SDK already has the message).
 */
export function appendMessage(sessionId: string, message: UIMessage): void {
  const db = getSessionsDb();
  const now = Date.now();

  const run = db.transaction((): void => {
    const row = db
      .prepare(
        `SELECT messages_json
         FROM chat_sessions
         WHERE id = ?`,
      )
      .get(sessionId) as { messages_json: string } | undefined;

    if (!row) {
      throw new Error(`appendMessage: session not found: ${sessionId}`);
    }

    const messages = parseMessagesJson(row.messages_json);
    messages.push(message);
    const messages_json = JSON.stringify(messages);

    db.prepare(
      `UPDATE chat_sessions
       SET messages_json = ?, updated_at = ?
       WHERE id = ?`,
    ).run(messages_json, now, sessionId);
  });

  run();
}
