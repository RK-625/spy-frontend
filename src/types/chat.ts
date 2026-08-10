import {
  ChatStatus,
  FileUIPart,
  UIMessage,
} from "ai";

export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

type UseChatApi = ReturnType<typeof import("@ai-sdk/react").useChat>;

/**
 * Stream-only chat context — prefs live on PromptInputProvider.
 * Ask answers are normal user messages (agent ignores incomplete tool calls);
 * no addToolOutput surface.
 */
export interface ChatContextValue {
  status: ChatStatus;
  messages: UIMessage[];
  clearMessages: () => void;
  error: Error | undefined;
  stop: () => void;
  /** Same signature as useChat().sendMessage (text/files convenience form). */
  sendMessage: UseChatApi["sendMessage"];
}

/** Client open-tab identity (draft-* or aligned with server id after create). */
export type SessionKey = string;

/**
 * Open session entry for SessionMaintainer.
 * sessionId null = ephemeral draft (not in SQLite yet).
 * No initialMessages — hydrate via GET /api/sessions?id= when opening a real session.
 */
export type SessionMeta = {
  key: SessionKey;
  sessionId: string | null;
};

export function createDraftSessionMeta(): SessionMeta {
  const key = `draft-${crypto.randomUUID()}`;
  return { key, sessionId: null };
}
