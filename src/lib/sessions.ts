/**
 * Node / API-route only — better-sqlite3 native binding.
 * Do not import from client components or Edge runtime.
 * (server-only package not installed; enforce by import graph.)
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { UIMessage } from "ai";
import Database from "better-sqlite3";
import {
  ChatMessage,
  ChatSession,
} from "@/types/session-schema";

/**
 * Local SQLite file for chat session catalog + transcripts.
 * Override with SESSIONS_DB_PATH. Parent dir is ensured on open.
 */
const SESSIONS_DB_PATH = resolve(
  process.env.SESSIONS_DB_PATH ?? ".data/sessions.db",
);

/** Default page size for Recents (S0: paginated pages of 30). */
const DEFAULT_SESSION_LIST_LIMIT = 30;

/** Process-singleton; null until first successful open (failed open stays null for retry). */
let sessionsDb: Database.Database | null = null;

// ---------------------------------------------------------------------------
// List pagination types
// ---------------------------------------------------------------------------

export type SessionListCursor = { updated_at: number; id: string };

export type ListSessionsParams = {
  limit?: number;
  cursor?: SessionListCursor | null;
};

export type ListSessionsResult = {
  sessions: ChatSession[];
  nextCursor: SessionListCursor | null;
};

export type CreateSessionInput = {
  id?: string;
  title: string;
  created_at?: number;
};

export type AppendMessageInput = {
  id?: string;
  session_id: string;
  role: ChatMessage["role"];
  parts: UIMessage["parts"];
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
 * Idempotent schema setup: tables + indexes for chat sessions / messages.
 * Safe to call on every open (CREATE IF NOT EXISTS).
 */
export function setupSessionsDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL REFERENCES chat_sessions(id),
      ordinal     INTEGER NOT NULL,
      role        TEXT NOT NULL,
      parts_json  TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_ordinal
      ON chat_messages (session_id, ordinal);

    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at
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
// Row parsers (Zod fail-soft)
// ---------------------------------------------------------------------------

function parseSessionRow(row: unknown): ChatSession | null {
  const result = ChatSession.safeParse(row);
  if (!result.success) {
    console.error("Invalid chat_sessions row", result.error.flatten());
    return null;
  }
  return result.data;
}

function parseMessageRow(row: unknown): ChatMessage | null {
  const result = ChatMessage.safeParse(row);
  if (!result.success) {
    console.error("Invalid chat_messages row", result.error.flatten());
    return null;
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Session catalog CRUD
// ---------------------------------------------------------------------------

/**
 * Paginated Recents list: newest first (updated_at DESC, id DESC).
 * Cursor: rows strictly older than (updated_at, id).
 */
export function listSessions(
  params: ListSessionsParams = {},
): ListSessionsResult {
  const db = getSessionsDb();
  const limit = params.limit ?? DEFAULT_SESSION_LIST_LIMIT;
  const cursor = params.cursor ?? null;

  type SessionRow = {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
  };

  const rows: SessionRow[] = cursor
    ? db
        .prepare(
          `SELECT id, title, created_at, updated_at
           FROM chat_sessions
           WHERE updated_at < ?
              OR (updated_at = ? AND id < ?)
           ORDER BY updated_at DESC, id DESC
           LIMIT ?`,
        )
        .all(cursor.updated_at, cursor.updated_at, cursor.id, limit) as SessionRow[]
    : db
        .prepare(
          `SELECT id, title, created_at, updated_at
           FROM chat_sessions
           ORDER BY updated_at DESC, id DESC
           LIMIT ?`,
        )
        .all(limit) as SessionRow[];

  const sessions: ChatSession[] = [];
  for (const row of rows) {
    const parsed = parseSessionRow(row);
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

/** Insert a new chat_sessions row. Product path: first user message only. */
export function createSession(input: CreateSessionInput): ChatSession {
  const db = getSessionsDb();
  const now = Date.now();
  const session: ChatSession = {
    id: input.id ?? crypto.randomUUID(),
    title: input.title,
    created_at: input.created_at ?? now,
    updated_at: input.created_at ?? now,
  };

  db.prepare(
    `INSERT INTO chat_sessions (id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  ).run(session.id, session.title, session.created_at, session.updated_at);

  return session;
}

export function getSession(sessionId: string): ChatSession | null {
  const db = getSessionsDb();
  const row = db
    .prepare(
      `SELECT id, title, created_at, updated_at
       FROM chat_sessions
       WHERE id = ?`,
    )
    .get(sessionId);
  if (!row) return null;
  return parseSessionRow(row);
}

/**
 * First-user-message title path: trim + slice, UPDATE title (and updated_at).
 * Single title setter — do not add a separate titleFromUserText helper.
 */
export function setSessionTitle(
  sessionId: string,
  text: string,
  maxLen?: number,
): string {
  const db = getSessionsDb();
  const title = text.trim().slice(0, maxLen ?? 80);
  const updated_at = Date.now();
  db.prepare(
    `UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?`,
  ).run(title, updated_at, sessionId);
  return title;
}

// ---------------------------------------------------------------------------
// Message transcript CRUD
// ---------------------------------------------------------------------------

/** Messages for a session, stable order (ordinal ASC). */
export function getSessionMessages(sessionId: string): ChatMessage[] {
  const db = getSessionsDb();
  const rows = db
    .prepare(
      `SELECT id, session_id, ordinal, role, parts_json, created_at
       FROM chat_messages
       WHERE session_id = ?
       ORDER BY ordinal ASC`,
    )
    .all(sessionId);

  const messages: ChatMessage[] = [];
  for (const row of rows) {
    const parsed = parseMessageRow(row);
    if (parsed) messages.push(parsed);
  }
  return messages;
}

/**
 * Append one message: assign next ordinal (MAX+1), insert, bump session updated_at.
 * Runs in a single transaction.
 */
export function appendMessage(input: AppendMessageInput): ChatMessage {
  const db = getSessionsDb();
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  const parts_json = JSON.stringify(input.parts);

  const run = db.transaction((): ChatMessage => {
    const maxRow = db
      .prepare(
        `SELECT MAX(ordinal) AS max_ord
         FROM chat_messages
         WHERE session_id = ?`,
      )
      .get(input.session_id) as { max_ord: number | null } | undefined;

    const ordinal =
      maxRow?.max_ord === null || maxRow?.max_ord === undefined
        ? 0
        : maxRow.max_ord + 1;

    db.prepare(
      `INSERT INTO chat_messages
         (id, session_id, ordinal, role, parts_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.session_id, ordinal, input.role, parts_json, now);

    db.prepare(
      `UPDATE chat_sessions SET updated_at = ? WHERE id = ?`,
    ).run(now, input.session_id);

    return {
      id,
      session_id: input.session_id,
      ordinal,
      role: input.role,
      parts_json,
      created_at: now,
    };
  });

  return run();
}

// ---------------------------------------------------------------------------
// UIMessage hydration
// ---------------------------------------------------------------------------

/**
 * Map a persisted row → AI SDK UIMessage. Fail soft: log + null on bad JSON/shape.
 */
export function messageToUIMessage(row: ChatMessage): UIMessage | null {
  try {
    const partsUnknown: unknown = JSON.parse(row.parts_json);
    if (!Array.isArray(partsUnknown)) {
      console.error("messageToUIMessage: parts_json is not an array", {
        id: row.id,
      });
      return null;
    }
    return {
      id: row.id,
      role: row.role,
      parts: partsUnknown as UIMessage["parts"],
    };
  } catch (error: unknown) {
    console.error("messageToUIMessage: failed to parse parts_json", {
      id: row.id,
      error,
    });
    return null;
  }
}

/** Hydrate full transcript for useChat / session switch. Skips corrupt rows. */
export function getSessionUIMessages(sessionId: string): UIMessage[] {
  const rows = getSessionMessages(sessionId);
  const messages: UIMessage[] = [];
  for (const row of rows) {
    const ui = messageToUIMessage(row);
    if (ui) messages.push(ui);
  }
  return messages;
}
