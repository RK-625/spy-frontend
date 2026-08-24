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
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  deleteChat as deleteChatRequest,
  fetchChat,
  saveChatMessages,
} from "@/lib/chats-api";
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

  const deletedIdsRef = useRef(new Set<string>());

  // eslint-disable-next-line react-hooks/refs -- createChat stores ref in onFinish callback; not read during render
  const [activeChat, setActiveChat] = useState(() =>
    createChat(crypto.randomUUID(), [], updateChatOrder, deletedIdsRef),
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
    const chat = createChat(
      crypto.randomUUID(),
      [],
      updateChatOrder,
      deletedIdsRef,
    );
    chatsRef.current.set(chat.id, chat);
    setActiveChat(chat);
  }, [updateChatOrder]);

  /**
   * Activate by id: Map hit reuses live Chat; miss hydrates from GET /api/chats.
   */
  const switchChat = useCallback(
    async (chatId: string) => {
      let chat = chatsRef.current.get(chatId);
      if (!chat) {
        const row = await fetchChat(chatId);
        chat = createChat(
          row.id,
          row.messages,
          updateChatOrder,
          deletedIdsRef,
        );
        chatsRef.current.set(chat.id, chat);
      }
      setActiveChat(chat);
    },
    [updateChatOrder],
  );

  /**
   * Remove chat from SQLite and active memory. Tombstones the id so background
   * streams cannot resurrect the row via onFinish upsert.
   */
  const deleteChat = useCallback(
    async (chatId: string) => {
      const id = chatId.trim();
      if (id.length === 0) return;

      deletedIdsRef.current.add(id);

      const registered = chatsRef.current.get(id);
      if (registered) {
        try {
          await registered.stop();
        } catch {
          // still delete even if stop throws
        }
      }
      chatsRef.current.delete(id);

      const wasActive = activeChat.id === id;

      try {
        await deleteChatRequest(id);
        if (wasActive) {
          newChat();
        }
        updateChatOrder();
      } catch (err: unknown) {
        if (wasActive) {
          newChat();
        }
        throw err;
      }
    },
    [activeChat.id, newChat, updateChatOrder],
  );

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
      deleteChat,
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
      deleteChat,
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
  deletedIdsRef: MutableRefObject<Set<string>>,
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
          // Same upsert-resurrection risk as onFinish if submit races delete.
          if (deletedIdsRef.current.has(id)) {
            throw new Error("chat deleted");
          }
          await saveChatMessages(id, outgoing);
          updateChatOrder();
        }
        return {
          body: { ...body, id, messages: outgoing, trigger, messageId },
        };
      },
    }),
    onFinish: ({ messages: finished }) => {
      // Deleted chats must not upsert: POST /api/chats creates a missing row.
      if (deletedIdsRef.current.has(chatId)) return;
      void saveChatMessages(chatId, finished)
        .then(() => updateChatOrder())
        .catch((err: unknown) => {
          console.error("saveChatMessages:", err);
        });
    },
  });
}

