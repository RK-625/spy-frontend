"use client";

import { DefaultChatTransport, type UIMessage } from "ai";
import { Chat, useChat } from "@ai-sdk/react";
import { usePathname, useRouter } from "next/navigation";
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
} from "@/lib/chats/api";
import { discardDraftForDeletedChat } from "@/lib/storage/prompt-draft-store";
import type { ChatContextValue } from "@/types/chat";
import type { MemoryNode } from "@/types/graph-schema";
const ChatContext = createContext<ChatContextValue | null>(null);

const CHAT_PATH = "/chat";

function readHistoryChatId(state: unknown): string | null {
  if (state && typeof state === "object" && "chatId" in state) {
    const id = (state as { chatId: unknown }).chatId;
    if (typeof id === "string" && id.trim().length > 0) return id.trim();
  }
  return null;
}

function buildChatUrl(chatId: string, isNew: boolean): string {
  return isNew ? CHAT_PATH : `${CHAT_PATH}?c=${encodeURIComponent(chatId)}`;
}

function syncChatUrl(chatId: string, isNew: boolean, replace = false) {
  if (typeof window === "undefined") return;
  // replaceState on a non-/chat path desyncs the App Router.
  if (window.location.pathname !== CHAT_PATH) return;

  const target = buildChatUrl(chatId, isNew);
  const current = `${window.location.pathname}${window.location.search}`;
  const currentStateId = readHistoryChatId(window.history.state);

  if (current === target && currentStateId === chatId) return;

  const prev = window.history.state;
  const state = {
    ...(prev && typeof prev === "object" ? prev : {}),
    chatId,
  };
  if (replace) {
    window.history.replaceState(state, "", target);
  } else {
    window.history.pushState(state, "", target);
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
  const isNew = !param && !hasMessages;
  syncChatUrl(activeChatId, isNew, true);
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
  const pathname = usePathname();
  const router = useRouter();

  const [chatOrder, setChatOrder] = useState(0);
  const [selectedNote, setSelectedNoteState] = useState<MemoryNode | null>(null);
  const updateChatOrder = useCallback(() => {
    setChatOrder((n) => n + 1);
  }, []);

  const setSelectedNote = useCallback((note: MemoryNode | null) => {
    if (note !== null && window.location.pathname !== CHAT_PATH) return;
    setSelectedNoteState(note);
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

  const switchGenerationRef = useRef(0);
  const switchAbortRef = useRef<AbortController | null>(null);

  /** Empty conversation at /chat. New-chat button pushes; missing-chat 404 replaces. */
  const landOnEmptyChat = useCallback(
    (replace: boolean) => {
      switchAbortRef.current?.abort();
      switchAbortRef.current = null;
      switchGenerationRef.current += 1;
      setSelectedNoteState(null);
      const chat = createChat(
        crypto.randomUUID(),
        [],
        updateChatOrder,
        deletedIdsRef,
      );
      chatsRef.current.set(chat.id, chat);
      setActiveChat(chat);
      activeChatIdRef.current = chat.id;
      syncChatUrl(chat.id, true, replace);
    },
    [updateChatOrder],
  );

  /** Mint id, register empty Chat, set active (keeps other open chats). */
  const newChat = useCallback(() => {
    landOnEmptyChat(false);
    if (window.location.pathname !== CHAT_PATH) {
      router.push(CHAT_PATH);
    }
  }, [landOnEmptyChat, router]);

  /**
   * Activate by id: Map hit reuses live Chat; miss hydrates from GET /api/chats.
   * Stale/aborted fetches must not touch React state or the URL.
   */
  const switchChat = useCallback(
    async (chatId: string, replace = false, writeUrl = true) => {
      if (activeChatIdRef.current === chatId) {
        if (writeUrl && window.location.pathname !== CHAT_PATH) {
          router.push(buildChatUrl(chatId, false));
        }
        return;
      }

      switchAbortRef.current?.abort();
      switchAbortRef.current = null;
      switchGenerationRef.current += 1;

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
          if (deletedIdsRef.current.has(row.id)) {
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

        if (deletedIdsRef.current.has(chatId)) return;

        setSelectedNoteState(null);
        setActiveChat(chat);
        activeChatIdRef.current = chat.id;
        if (writeUrl) {
          if (window.location.pathname !== CHAT_PATH) {
            router.push(buildChatUrl(chatId, false));
          } else {
            syncChatUrl(chatId, false, replace);
          }
        }
      } catch (err: unknown) {
        if (isAbortError(err) || gen !== switchGenerationRef.current) {
          return;
        }
        if (isChatNotFoundError(err)) {
          if (replace) {
            setSelectedNoteState(null);
            syncChatUrl(activeChatIdRef.current, true, true);
            return;
          }
          landOnEmptyChat(true);
          return;
        }
        restoreActiveChatUrl(activeChatIdRef.current, chatsRef.current);
        throw err;
      }
    },
    [landOnEmptyChat, router, updateChatOrder],
  );

  useEffect(() => {
    if (pathname !== CHAT_PATH) return;

    const paramChatId = new URLSearchParams(window.location.search)
      .get("c")
      ?.trim();
    if (paramChatId) {
      if (paramChatId === activeChatIdRef.current) return;
      void switchChat(paramChatId, true).catch((err: unknown) => {
        console.error("Failed to hydrate chat from URL:", err);
      });
      return;
    }

    const instance = chatsRef.current.get(activeChatIdRef.current);
    const hasMessages = (instance?.messages.length ?? 0) > 0;
    syncChatUrl(activeChatIdRef.current, !hasMessages, true);
  }, [pathname, switchChat]);

  useEffect(() => {
    return () => {
      switchAbortRef.current?.abort();
      switchAbortRef.current = null;
      switchGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      syncChatUrl(activeChat.id, false, true);
    }
  }, [messages.length, activeChat.id]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (window.location.pathname !== CHAT_PATH) return;

      const queryParam = new URLSearchParams(window.location.search).get("c")?.trim();
      const chatId = (queryParam && queryParam.length > 0)
        ? queryParam
        : readHistoryChatId(event.state);

      if (chatId) {
        void switchChat(chatId, false, false).catch((err: unknown) => {
          console.error("switchChat (popstate):", err);
        });
      } else {
        landOnEmptyChat(true);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [switchChat, landOnEmptyChat]);

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
      switchAbortRef.current?.abort();
      switchAbortRef.current = null;
      switchGenerationRef.current += 1;

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
        await discardDraftForDeletedChat(id);
        if (wasActive) {
          landOnEmptyChat(true);
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
    [landOnEmptyChat, updateChatOrder],
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
      setSelectedNote,
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
