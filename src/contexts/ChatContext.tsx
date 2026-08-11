"use client";

import { DefaultChatTransport, type UIMessage } from "ai";
import { Chat, useChat } from "@ai-sdk/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChatContextValue } from "@/types/chat";

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Stream chat provider with multi-chat AI SDK Chat registry.
 *
 * - `activeChat` is React state → legal to read in render / pass to useChat.
 * - `chatsRef` holds all open Chat instances for multi-stream; read/write only
 *   in event handlers (newChat / switchChat), never during render.
 * - Invariant: every activate goes through setActiveChat with a Chat that is
 *   (or was just) registered in the Map.
 * - Hydrate-from-DB on cold open: next hunk via GET /api/chats (not SQLite in client).
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeChat, setActiveChat] = useState(() =>
    createChat(crypto.randomUUID()),
  );
  const { messages, status, stop, sendMessage, error } = useChat<UIMessage>({
    chat: activeChat,
    experimental_throttle: 50,
  });

  /** Open chats by id. Not render input — handlers only. */
  const chatsRef = useRef(
    new Map<string, Chat<UIMessage>>([[activeChat.id, activeChat]]),
  );

  /** Mint id, register empty Chat, set active (keeps other open chats). */
  const newChat = useCallback(() => {
    const chat = createChat(crypto.randomUUID());
    chatsRef.current.set(chat.id, chat);
    setActiveChat(chat);
  }, []);

  /**
   * Activate a chat already in the Map. Throws if missing
   * (open/hydrate via GET /api/chats — next hunk).
   */
  const switchChat = useCallback((chatId: string) => {
    const chat = chatsRef.current.get(chatId);
    if (!chat) {
      throw new Error(
        `switchChat: chat not in registry: ${chatId} (hydrate before activate)`,
      );
    }
    setActiveChat(chat);
  }, []);

  const value: ChatContextValue = useMemo(
    () => ({
      chatId: activeChat.id,
      status,
      messages,
      error,
      stop,
      sendMessage,
      newChat,
      switchChat,
    }),
    [
      activeChat.id,
      status,
      messages,
      error,
      stop,
      sendMessage,
      newChat,
      switchChat,
    ],
  );

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return ctx;
}

function createChat(
  chatId: string,
  messages: UIMessage[] = [],
): Chat<UIMessage> {
  return new Chat<UIMessage>({
    id: chatId,
    messages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });
}
