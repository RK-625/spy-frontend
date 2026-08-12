import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import {
  CorruptChatError,
  getChatWithMessages,
  listChats,
  upsertChatMessages,
  type ChatListCursor,
} from "@/lib/chats";
import type { ChatMeta } from "@/types/chat-schema";

/** better-sqlite3 — Node.js only. */
export const runtime = "nodejs";

/** POST create-or-append success body (meta only; same shape for both paths). */
type ChatsPostResponse = {
  ok: true;
  chat: ChatMeta;
};

const CHAT_LIST_LIMIT_DEFAULT = 30;
const CHAT_LIST_LIMIT_MIN = 1;
const CHAT_LIST_LIMIT_MAX = 100;
const CHAT_TITLE_MAX_LEN = 80;
const CHAT_TITLE_FALLBACK = "New chat";

function encodeCursor(cursor: ChatListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string): ChatListCursor | null {
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
  if (raw === null || raw === "") return CHAT_LIST_LIMIT_DEFAULT;
  const n = Number(raw);
  if (
    !Number.isInteger(n) ||
    n < CHAT_LIST_LIMIT_MIN ||
    n > CHAT_LIST_LIMIT_MAX
  ) {
    return {
      error: `limit must be an integer ${CHAT_LIST_LIMIT_MIN}–${CHAT_LIST_LIMIT_MAX}`,
    };
  }
  return n;
}

function textFromMessage(message: UIMessage): string {
  const texts: string[] = [];
  for (const part of message.parts ?? []) {
    if (part.type === "text" && typeof part.text === "string") {
      texts.push(part.text);
    }
  }
  return texts.join(" ").trim();
}

/** First user text for create title; else fallback. */
function titleFromMessages(messages: UIMessage[]): string {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = textFromMessage(message);
    if (text.length > 0) {
      return text.slice(0, CHAT_TITLE_MAX_LEN);
    }
  }
  return CHAT_TITLE_FALLBACK;
}

/**
 * GET /api/chats
 * - `?id=` → chat + messages (404 if missing)
 * - else → paginated meta list (`limit` default 30, optional `cursor`)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim() ?? "";

    if (id.length > 0) {
      try {
        const chat = getChatWithMessages(id);
        if (!chat) {
          return NextResponse.json(
            { ok: false, error: "chat not found" },
            { status: 404 },
          );
        }
        return NextResponse.json({ ok: true, chat });
      } catch (error: unknown) {
        if (error instanceof CorruptChatError) {
          console.error("GET /api/chats corrupt:", error.chatId, error.reason);
          return NextResponse.json(
            {
              ok: false,
              error: "chat transcript corrupt",
              code: "CORRUPT_MESSAGES",
              reason: error.reason,
            },
            { status: 422 },
          );
        }
        throw error;
      }
    }

    const limitResult = parseLimit(url.searchParams.get("limit"));
    if (typeof limitResult === "object") {
      return NextResponse.json(
        { ok: false, error: limitResult.error },
        { status: 400 },
      );
    }

    let cursor: ChatListCursor | null = null;
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

    const { chats, nextCursor } = listChats({
      limit: limitResult,
      cursor,
    });
    return NextResponse.json({
      ok: true,
      chats,
      nextCursor: nextCursor ? encodeCursor(nextCursor) : null,
    });
  } catch (error: unknown) {
    console.error("GET /api/chats:", error);
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
 * POST /api/chats — create-or-replace full transcript
 * Body: `{ chatId: string, messages: UIMessage[] }`
 * - row missing → create with id = chatId, title from first user text
 * - row exists → replace messages_json + updated_at (title kept)
 * Always returns meta: `{ ok: true, chat: ChatMeta }`.
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

    const record = body as { chatId?: unknown; messages?: unknown };

    if (typeof record.chatId !== "string" || record.chatId.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "chatId is required" },
        { status: 400 },
      );
    }
    const chatId = record.chatId.trim();

    if (!Array.isArray(record.messages)) {
      return NextResponse.json(
        { ok: false, error: "messages must be an array" },
        { status: 400 },
      );
    }
    const messages = record.messages as UIMessage[];

    const chat = upsertChatMessages({
      id: chatId,
      title: titleFromMessages(messages),
      messages,
    });

    const response: ChatsPostResponse = { ok: true, chat };
    return NextResponse.json(response);
  } catch (error: unknown) {
    if (error instanceof CorruptChatError) {
      console.error("POST /api/chats corrupt:", error.chatId, error.reason);
      return NextResponse.json(
        {
          ok: false,
          error: "chat transcript corrupt; refuse overwrite",
          code: "CORRUPT_MESSAGES",
          reason: error.reason,
        },
        { status: 422 },
      );
    }
    console.error("POST /api/chats:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
