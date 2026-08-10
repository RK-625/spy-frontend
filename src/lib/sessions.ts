/**
 * Node / API-route only — better-sqlite3 native binding.
 * Do not import from client components or Edge runtime.
 * (server-only package not installed; enforce by import graph.)
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

/**
 * Local SQLite file for chat session catalog + transcripts.
 * Override with SESSIONS_DB_PATH. Parent dir is ensured on open.
 */
const SESSIONS_DB_PATH = resolve(
  process.env.SESSIONS_DB_PATH ?? ".data/sessions.db",
);

/** Process-singleton; null until first successful open (failed open stays null for retry). */
let sessionsDb: Database.Database | null = null;

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
