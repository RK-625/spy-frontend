import {
  ChatStatus,
  FileUIPart,
  ModelMessage,
  UIMessage,
} from "ai";

export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

/** Which agent issued a graph-history message. */
export type GraphMessageSource = "chat" | "graph";

/**
 * Graph-history message with a required origin marker. The SDK tolerates
 * the extra field (prompt validation strips unknown keys; provider mappers
 * read known fields only).
 */
export type SourcedModelMessage = ModelMessage & {
  graphSource: GraphMessageSource;
};

type UseChatApi = ReturnType<typeof import("@ai-sdk/react").useChat>;

/**
 * Stream-only chat context — prefs live on PromptInputProvider.
 * Ask answers are normal user messages (agent ignores incomplete tool calls);
 * no addToolOutput surface.
 *
 * One id per open conversation: minted at Map register, equals AI SDK Chat.id
 * and (after first persist) SQLite row PK. No draft/server dual identity.
 */
/** Graph-agent run, beside the message feed. "idle" is a finished run. */
export type GraphJobStatus = "idle" | "running" | "failed";

export interface ChatContextValue {
  /** Active conversation id (always registered in the Chat map). */
  chatId: string;
  status: ChatStatus;
  messages: UIMessage[];
  graphMessages: ModelMessage[];
  graphJobStatus: GraphJobStatus;
  error: Error | undefined;
  stop: () => void;
  /** Same signature as useChat().sendMessage (text/files convenience form). */
  sendMessage: UseChatApi["sendMessage"];
  /**
   * Mint a new id, register an empty Chat, switch active.
   * Does not wipe other open chats (multi-stream).
   */
  newChat: () => void;
  /**
   * Activate chat by id. Map hit → reuse Chat instance.
   * Map miss → GET /api/chats?id= hydrate, register, then activate.
   * When replace is true, updates URL via replaceState instead of pushState.
   */
  switchChat: (chatId: string, replace?: boolean) => Promise<void>;
  /**
   * Remove a conversation from SQLite and active memory.
   */
  deleteChat: (chatId: string) => Promise<void>;
  /** Catalog revision after persist; Recents refetch. */
  chatOrder: number;
}
