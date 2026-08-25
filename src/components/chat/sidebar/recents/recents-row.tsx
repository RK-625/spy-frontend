"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import type { ChatMeta } from "@/types/chat-schema";

interface ChatSidebarRecentsRowProps {
  chat: ChatMeta;
  isActiveChat: boolean;
  onOpenChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => Promise<void>;
}

export function ChatSidebarRecentsRow({
  chat,
  isActiveChat,
  onOpenChat,
  onDeleteChat,
}: ChatSidebarRecentsRowProps) {
  const [gutterMenuOpen, setGutterMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex w-full items-center rounded-[var(--radius)] text-[0.8125rem] transition-colors",
        isActiveChat
          ? "bg-[var(--surface-focus)] text-text-primary"
          : cn(
              "text-text-primary hover:bg-[var(--surface-hover)]",
              gutterMenuOpen && "bg-[var(--surface-hover)]",
            ),
      )}
    >
      <button
        type="button"
        onClick={() => onOpenChat(chat.id)}
        aria-current={isActiveChat ? "true" : undefined}
        title={chat.title}
        className={cn(
          "w-full min-w-0 rounded-[var(--radius)] px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          "group-hover:pr-7 group-focus-within:pr-7",
          gutterMenuOpen && "pr-7",
        )}
      >
        <span
          className={cn(
            "block min-w-0 overflow-hidden whitespace-nowrap",
            !gutterMenuOpen &&
              "truncate group-hover:text-clip group-focus-within:text-clip",
            "group-hover:[mask-image:linear-gradient(to_right,#000_0%,#000_calc(100%-16px),transparent_100%)]",
            "group-focus-within:[mask-image:linear-gradient(to_right,#000_0%,#000_calc(100%-16px),transparent_100%)]",
            gutterMenuOpen &&
              "[mask-image:linear-gradient(to_right,#000_0%,#000_calc(100%-16px),transparent_100%)]",
          )}
        >
          {chat.title}
        </span>
      </button>

      <DropdownMenu open={gutterMenuOpen} onOpenChange={setGutterMenuOpen}>
        <DropdownMenuTrigger
          aria-label={`Chat actions for ${chat.title}`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "absolute top-1/2 right-1 z-10 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--radius)] bg-[var(--surface-hover)] text-text-secondary outline-none transition-[opacity,scale,background-color] duration-150 ease-out",
            "opacity-0 scale-95 pointer-events-none",
            "group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100",
            "group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100",
            "focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            "hover:bg-[var(--surface-focus)] focus-visible:bg-[var(--surface-focus)] data-[state=open]:bg-[var(--surface-focus)]",
            "data-[state=open]:pointer-events-auto data-[state=open]:scale-100 data-[state=open]:opacity-100",
          )}
        >
          <span className="flex flex-col items-center gap-[3px]" aria-hidden>
            <span className="size-[3px] rounded-full bg-current" />
            <span className="size-[3px] rounded-full bg-current" />
            <span className="size-[3px] rounded-full bg-current" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="center"
          sideOffset={4}
          // Do not restore trigger :focus after pointer dismiss (leftover gutter).
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="w-auto min-w-32 overflow-hidden rounded-[var(--radius)]"
        >
          <DropdownMenuItem
            variant="destructive"
            className="min-h-0 rounded-[var(--radius-sm)] px-1 py-0.25"
            onSelect={() => {
              void onDeleteChat(chat.id);
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
