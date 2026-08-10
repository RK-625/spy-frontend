import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import {
  appendMessage,
  createSession,
  getSession,
  getSessionWithMessages,
  listSessions,
  type SessionListCursor,
} from "@/lib/sessions";

/** better-sqlite3 — Node.js only. */
export const runtime = "nodejs";

const SESSION_LIST_LIMIT_DEFAULT = 30;
const SESSION_LIST_LIMIT_MIN = 1;
const SESSION_LIST_LIMIT_MAX = 100;
const SESSION_TITLE_MAX_LEN = 80;
const SESSION_TITLE_FALLBACK = "New chat";

function encodeCursor(cursor: SessionListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string): SessionListCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) return null;
    const { updated_at, id } = parsed as {
      updated_at?: unknown;
      id?: unknown;
    };
    if (typeof updated_at !== "number" || typeof id !== "string") return null;
    return { updated_at, id };
  } catch {
    return null;
  }
}

/** Missing → default 30; present but invalid → 400. */
function parseLimit(raw: string | null): number | { error: string } {
  if (raw === null || raw === "") return SESSION_LIST_LIMIT_DEFAULT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < SESSION_LIST_LIMIT_MIN || n > SESSION_LIST_LIMIT_MAX) {
    return {
      error: `limit must be an integer ${SESSION_LIST_LIMIT_MIN}–${SESSION_LIST_LIMIT_MAX}`,
    };
  }
  return n;
}

function titleFromMessage(message: UIMessage): string {
  const texts: string[] = [];
  for (const part of message.parts ?? []) {
    if (part.type === "text" && typeof part.text === "string") {
      texts.push(part.text);
    }
  }
  const joined = texts.join(" ").trim();
  return joined.length > 0
    ? joined.slice(0, SESSION_TITLE_MAX_LEN)
    : SESSION_TITLE_FALLBACK;
}

/**
 * GET /api/sessions
 * - `?id=` → session + messages (404 if missing)
 * - else → paginated meta list (`limit` default 30, optional `cursor`)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim() ?? "";

    if (id.length > 0) {
      const session = getSessionWithMessages(id);
      if (!session) {
        return NextResponse.json(
          { ok: false, error: "session not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, session });
    } else {
      const limitResult = parseLimit(url.searchParams.get("limit"));
      if (typeof limitResult === "object") {
        return NextResponse.json(
          { ok: false, error: limitResult.error },
          { status: 400 },
        );
      }

      let cursor: SessionListCursor | null = null;
      const cursorRaw = url.searchParams.get("cursor");
      if (cursorRaw) {
        cursor = decodeCursor(cursorRaw);
        if (!cursor) {
          return NextResponse.json(
            { ok: false, error: "invalid cursor" },
            { status: 400 },
          );
        }
      }

      const { sessions, nextCursor } = listSessions({
        limit: limitResult,
        cursor,
      });
      return NextResponse.json({
        ok: true,
        sessions,
        nextCursor: nextCursor ? encodeCursor(nextCursor) : null,
      });
    }
  } catch (error: unknown) {
    console.error("GET /api/sessions:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sessions — create-or-append
 * Body: `{ sessionId?: string, message: UIMessage }`
 * Returns meta-only session.
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid JSON body" },
        { status: 400 },
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { ok: false, error: "invalid body" },
        { status: 400 },
      );
    }

    const record = body as { sessionId?: unknown; message?: unknown };
    if (typeof record.message !== "object" || record.message === null) {
      return NextResponse.json(
        { ok: false, error: "message is required" },
        { status: 400 },
      );
    }
    const message = record.message as UIMessage;

    const sessionId =
      typeof record.sessionId === "string" && record.sessionId.trim().length > 0
        ? record.sessionId.trim()
        : null;

    if (sessionId) {
      if (!getSession(sessionId)) {
        return NextResponse.json(
          { ok: false, error: "session not found" },
          { status: 404 },
        );
      }
      appendMessage(sessionId, message);
      const updated = getSession(sessionId);
      if (!updated) {
        return NextResponse.json(
          { ok: false, error: "session not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, session: updated });
    } else {
      const created = createSession({
        title: titleFromMessage(message),
        messages: [message],
      });
      const { id, title, created_at, updated_at } = created;
      return NextResponse.json({
        ok: true,
        session: { id, title, created_at, updated_at },
      });
    }
  } catch (error: unknown) {
    console.error("POST /api/sessions:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
