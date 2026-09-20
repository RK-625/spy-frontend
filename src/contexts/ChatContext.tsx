"use client";

import { DefaultChatTransport, type UIMessage } from "ai";
import { Chat, useChat } from "@ai-sdk/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  deleteChat as deleteChatRequest,
  fetchChat,
  isChatNotFoundError,
  saveChatMessages,
} from "@/lib/chats-api";
import type { ChatContextValue } from "@/types/chat";
import type { MemoryNode } from "@/types/graph-schema";

const ChatContext = createContext<ChatContextValue | null>(null);

function syncChatUrl(chatId: string | null, replace = false) {
  if (typeof window === "undefined") return;
  const target = chatId
    ? `${window.location.pathname}?c=${encodeURIComponent(chatId)}`
    : window.location.pathname;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== target) {
    if (replace) {
      window.history.replaceState(null, "", target);
    } else {
      window.history.pushState(null, "", target);
    }
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/** After a failed switch, put `?c=` back on the chat that is still active. */
function restoreActiveChatUrl(
  activeChatId: string,
  chats: Map<string, Chat<UIMessage>>,
) {
  const param = new URLSearchParams(window.location.search).get("c");
  const instance = chats.get(activeChatId);
  const hasMessages = (instance?.messages.length ?? 0) > 0;
  if (param === activeChatId || hasMessages) {
    syncChatUrl(activeChatId, true);
  } else {
    syncChatUrl(null, true);
  }
}

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
  const [selectedNote, setSelectedNote] = useState<MemoryNode | null>(null);
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

  const activeChatIdRef = useRef(activeChat.id);
  activeChatIdRef.current = activeChat.id;

  const switchGenerationRef = useRef(0);
  const switchAbortRef = useRef<AbortController | null>(null);

  /** Empty conversation at /home. New-chat button pushes; missing-chat 404 replaces. */
  const landOnEmptyHome = useCallback(
    (replace: boolean) => {
      setSelectedNote(null);
      const chat = createChat(
        crypto.randomUUID(),
        [],
        updateChatOrder,
        deletedIdsRef,
      );
      chatsRef.current.set(chat.id, chat);
      setActiveChat(chat);
      syncChatUrl(null, replace);
    },
    [updateChatOrder],
  );

  /** Mint id, register empty Chat, set active (keeps other open chats). */
  const newChat = useCallback(() => {
    landOnEmptyHome(false);
  }, [landOnEmptyHome]);

  /**
   * Activate by id: Map hit reuses live Chat; miss hydrates from GET /api/chats.
   * Stale/aborted fetches must not touch React state or the URL.
   */
  const switchChat = useCallback(
    async (chatId: string, replace = false) => {
      switchAbortRef.current?.abort();
      switchAbortRef.current = null;
      switchGenerationRef.current += 1;

      if (activeChatIdRef.current === chatId) return;

      const controller = new AbortController();
      switchAbortRef.current = controller;
      const gen = switchGenerationRef.current;

      try {
        let chat = chatsRef.current.get(chatId);
        if (!chat) {
          const row = await fetchChat(chatId, { signal: controller.signal });
          if (
            controller.signal.aborted ||
            gen !== switchGenerationRef.current
          ) {
            return;
          }
          chat = createChat(
            row.id,
            row.messages,
            updateChatOrder,
            deletedIdsRef,
          );
          chatsRef.current.set(chat.id, chat);
        }

        if (controller.signal.aborted || gen !== switchGenerationRef.current) {
          return;
        }

        setSelectedNote(null);
        setActiveChat(chat);
        syncChatUrl(chatId, replace);
      } catch (err: unknown) {
        if (isAbortError(err) || gen !== switchGenerationRef.current) {
          return;
        }
        if (isChatNotFoundError(err)) {
          if (replace) {
            setSelectedNote(null);
            syncChatUrl(null, true);
            return;
          }
          landOnEmptyHome(true);
          return;
        }
        restoreActiveChatUrl(activeChatIdRef.current, chatsRef.current);
        throw err;
      }
    },
    [landOnEmptyHome, updateChatOrder],
  );
// when u load the chat for the first time here
  useEffect(() => {
    const paramChatId = new URLSearchParams(window.location.search).get("c");
    if (paramChatId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate conversation from URL query on mount
      void switchChat(paramChatId, true).catch(
        (err: unknown) => {
          console.error("Failed to hydrate chat from URL:", err);
        },
      );
    }
    return () => {
      switchAbortRef.current?.abort();
      switchAbortRef.current = null;
      switchGenerationRef.current += 1;
    };
    // Mount-only: read `c` once. Do not re-hydrate when switchChat identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);
// when the chat here is activated here btw though here
  useEffect(() => {
    if (messages.length > 0) {
      syncChatUrl(activeChat.id, true);
    }
  }, [messages.length, activeChat.id]);
  // add the listener here for popstate reverse
  useEffect(() => {
    const handlePopState = () => {
      const param = new URLSearchParams(window.location.search).get("c");
      if (param) {
        void switchChat(param).catch((err: unknown) => {
          console.error("switchChat (popstate):", err);
        });
      } else {
        newChat();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [switchChat, newChat]);

  /**
   * Remove chat from SQLite and active memory. Tombstone + Map drop for the
   * in-flight DELETE so racing onFinish / prepareSend cannot upsert; rollback
   * both if DELETE fails so session state is a no-op.
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

      const wasActive = activeChatIdRef.current === id;

      try {
        await deleteChatRequest(id);
        if (wasActive) {
          newChat();
        }
        updateChatOrder();
      } catch (err: unknown) {
        deletedIdsRef.current.delete(id);
        if (registered) {
          chatsRef.current.set(id, registered);
        }
        throw err;
      }
    },
    [newChat, updateChatOrder],
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
      selectedNote,
      setSelectedNote,
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
      selectedNote,
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
          body: { ...body, id, chatId: id, messages: outgoing, trigger, messageId },
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

