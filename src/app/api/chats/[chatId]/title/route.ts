import { NextResponse } from "next/server";
import { runTitleAgent } from "@/ai/agent/title/agent";
import { modelConfig } from "@/ai/models/modelstore";
import { getChatWithMessages } from "@/lib/chats/sqlite";
import { firstUserText } from "@/lib/chats/title";
import { MissingProviderKeyError } from "@/lib/providers/keys/resolve-key";
import { models } from "@/lib/providers/registry";

/** better-sqlite3 + provider SDKs — Node.js only. */
export const runtime = "nodejs";

/** Bounds the prompt for very long first messages; the topic is near the top. */
const TITLE_PROMPT_MAX_LEN = 2000;

/**
 * POST /api/chats/[chatId]/title — generate (not save) a title. Body `{ model }`.
 * The caller saves it with PATCH /api/chats (`renameChat`).
 * - invalid body or unknown `model` → 400; missing provider key → 400 + `providerId`
 * - no such chat → 404
 * - chat has no user text, or model output is empty → 204 (keep the fallback)
 * - success → `{ ok: true, title }`
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid JSON body" },
        { status: 400 },
      );
    }
    const modelId =
      typeof body === "object" && body !== null && "model" in body
        ? body.model
        : undefined;
    const found =
      typeof modelId === "string"
        ? models.find((entry) => entry.id === modelId)
        : undefined;
    if (!found) {
      return NextResponse.json(
        { ok: false, error: "model is required and must be a known model" },
        { status: 400 },
      );
    }

    const chat = getChatWithMessages(chatId);
    if (!chat) {
      return NextResponse.json(
        { ok: false, error: "chat not found" },
        { status: 404 },
      );
    }
    const firstMessage = firstUserText(chat.messages).slice(
      0,
      TITLE_PROMPT_MAX_LEN,
    );
    if (firstMessage.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    // Lowest effort the model offers: a title needs no deep reasoning.
    const { model, providerOptions } = await modelConfig({
      model: found.id,
      mode: found.mode[0] ?? "",
    });
    const title = await runTitleAgent({ model, providerOptions, firstMessage });
    if (title.length === 0) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json({ ok: true, title });
  } catch (error: unknown) {
    if (error instanceof MissingProviderKeyError) {
      return NextResponse.json(
        { ok: false, error: error.message, providerId: error.providerId },
        { status: 400 },
      );
    }
    console.error("POST /api/chats/[chatId]/title:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
