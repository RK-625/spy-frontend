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
import { fetchChat, saveChatMessages } from "@/lib/chats-api";
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
 * - Durability is client `saveChatMessages` — await on submit-message,
 *   onFinish full snapshot.
 * - switchChat Map miss → fetchChat → createChat → register → activate.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatOrder, setChatOrder] = useState(0);
  const updateChatOrder = useCallback(() => {
    setChatOrder((n) => n + 1);
  }, []);

  const [activeChat, setActiveChat] = useState(() =>
    createChat(crypto.randomUUID(), [], updateChatOrder),
  );
  const { messages, status, stop, sendMessage, error } = useChat<UIMessage>({
    chat: activeChat,
    throttle: 50,
  });

  /** Open chats by id. Not render input — handlers only. */
  const chatsRef = useRef(
    new Map<string, Chat<UIMessage>>([[activeChat.id, activeChat]]),
  );

  /** Mint id, register empty Chat, set active (keeps other open chats). */
  const newChat = useCallback(() => {
    const chat = createChat(crypto.randomUUID(), [], updateChatOrder);
    chatsRef.current.set(chat.id, chat);
    setActiveChat(chat);
  }, []);

  /**
   * Activate by id: Map hit reuses live Chat; miss hydrates from GET /api/chats.
   */
  const switchChat = useCallback(async (chatId: string) => {
    let chat = chatsRef.current.get(chatId);
    if (!chat) {
      const row = await fetchChat(chatId);
      chat = createChat(row.id, row.messages, updateChatOrder);
      chatsRef.current.set(chat.id, chat);
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
      chatOrder,
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
      chatOrder,
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
  updateChatOrder: () => void,
): Chat<UIMessage> {
  return new Chat<UIMessage>({
    id: chatId,
    messages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async ({
        id,
        messages: outgoing,
        trigger,
        messageId,
        body,
      }) => {
        if (trigger === "submit-message") {
          await saveChatMessages(id, outgoing);
          updateChatOrder();
        }
        return {
          body: { ...body, id, messages: outgoing, trigger, messageId },
        };
      },
    }),
    onFinish: ({ messages: finished }) => {
      void saveChatMessages(chatId, finished)
        .then(() => updateChatOrder())
        .catch((err: unknown) => {
          console.error("saveChatMessages:", err);
        });
    },
  });
}
