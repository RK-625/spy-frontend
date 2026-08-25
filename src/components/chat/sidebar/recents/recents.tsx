"use client";

import { useCallback, useEffect, useState } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { listChats } from "@/lib/chats-api";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui";
import type { ChatMeta } from "@/types/chat-schema";
import { ChatSidebarRecentsRow } from "./recents-row";

function ChatSidebarRecentsRule() {
  return <div className="h-px flex-1 bg-[var(--accent-border)]" />;
}

export function ChatSidebarRecents({
  isSidebarFull,
}: {
  isSidebarFull: boolean;
}) {
  const { chatId, status, switchChat, deleteChat, chatOrder } =
    useChatContext();
  const [recents, setRecents] = useState<ChatMeta[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingRecents, setLoadingRecents] = useState(false);

  // Refresh when expanded, chat switch, active stream settle, or any chat persist
  // (background finish / new row).
  const streamReady = status === "ready";
  useEffect(() => {
    if (!isSidebarFull) return;
    let cancelled = false;
    void listChats()
      .then(({ chats, nextCursor: cursor }) => {
        if (!cancelled) {
          setRecents(chats);
          setNextCursor(cursor);
        }
      })
      .catch((err: unknown) => {
        console.error("listChats:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isSidebarFull, chatId, streamReady, chatOrder]);

  const handleOpenRecent = useCallback(
    (id: string) => {
      void switchChat(id).catch((err: unknown) => {
        console.error("switchChat:", err);
      });
    },
    [switchChat],
  );

  const handleDeleteRecent = useCallback(
    async (id: string) => {
      try {
        await deleteChat(id);
      } catch (err: unknown) {
        console.error("deleteChat:", err);
        toast.error("Failed to delete chat");
      }
    },
    [deleteChat],
  );

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || loadingRecents) return;
    setLoadingRecents(true);
    void listChats(nextCursor)
      .then(({ chats, nextCursor: cursor }) => {
        setRecents((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          const appended = chats.filter((c) => !seen.has(c.id));
          return appended.length === 0 ? prev : [...prev, ...appended];
        });
        setNextCursor(cursor);
      })
      .catch((err: unknown) => {
        console.error("listChats:", err);
      })
      .finally(() => {
        setLoadingRecents(false);
      });
  }, [nextCursor, loadingRecents]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="font-[family-name:var(--font-terminal)] text-[0.8125rem] font-medium uppercase tracking-[0.2em] text-text-secondary">
          Recents
        </span>
        <ChatSidebarRecentsRule />
      </div>
      {recents.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3">
          <span className="text-sm text-text-secondary">
            No conversations yet
          </span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
          {recents.map((chat) => (
            <ChatSidebarRecentsRow
              key={chat.id}
              chat={chat}
              isActiveChat={chat.id === chatId}
              onOpenChat={handleOpenRecent}
              onDeleteChat={handleDeleteRecent}
            />
          ))}
          {nextCursor ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingRecents}
              className={cn(
                "mt-1 w-full rounded-[var(--radius)] px-2 py-1.5 text-left text-[0.8125rem] outline-none transition-colors",
                "text-text-secondary hover:bg-[var(--surface-hover)] hover:text-text-primary",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {loadingRecents ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
