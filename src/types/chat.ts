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
 *
 * One id per open conversation: minted at Map register, equals AI SDK Chat.id
 * and (after first persist) SQLite row PK. No draft/server dual identity.
 */
export interface ChatContextValue {
  /** Active conversation id (always registered in the Chat map). */
  chatId: string;
  status: ChatStatus;
  messages: UIMessage[];
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
   */
  switchChat: (chatId: string) => Promise<void>;
  /**
   * Remove a conversation from SQLite and the in-memory Chat map.
   * Recents refetch via chatOrder. If it was active, mint a new empty chat.
   */
  deleteChat: (chatId: string) => Promise<void>;
  /** Catalog revision after persist; Recents refetch. */
  chatOrder: number;
}
