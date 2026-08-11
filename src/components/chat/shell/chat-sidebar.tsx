"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from "react";
import { motion } from "motion/react";
import { CommandPalette } from "./command-palette";
import { SettingsDialog } from "./settings-dialog";
import { useChatContext } from "@/contexts/ChatContext";
import { listChats } from "@/lib/chats-api";
import { cn } from "@/lib/utils";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { DotMatrixIcon } from "@/components/dotmatrix";
import type { ChatMeta } from "@/types/chat-schema";

type SidebarDisplayMode = "icon" | "full";
const SIDEBAR_MODE_STORAGE_KEY = "spy-sidebar-mode";
const DEFAULT_SIDEBAR_MODE: SidebarDisplayMode = "icon";

const SIDEBAR_ICON_WIDTH = 56;
const SIDEBAR_FULL_WIDTH = 240;
const SIDEBAR_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 32,
};

interface SidebarItemProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  shortcut?: string;
  active?: boolean;
  showLabel: boolean;
  variant?: "primary" | "default";
}

function SidebarItem({
  icon: Icon,
  label,
  onClick,
  shortcut,
  active = false,
  showLabel,
  variant = "default",
}: SidebarItemProps) {
  const isPrimaryVariant = variant === "primary";

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group relative flex w-full items-center rounded-[var(--radius)] transition-all duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        !isPrimaryVariant &&
          !active &&
          "text-text-primary hover:bg-[var(--surface-hover)]",
        active &&
          !isPrimaryVariant &&
          "bg-[var(--surface-focus)] text-text-primary",
        isPrimaryVariant &&
          "text-text-primary font-medium text-[0.8125rem] hover:bg-[var(--surface-hover)]",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center">
        <Icon size={ICON_GLYPH.toolbar} />
      </span>
      <motion.span
        initial={false}
        animate={{
          opacity: showLabel ? 1 : 0,
          width: showLabel ? "auto" : 0,
          marginLeft: showLabel ? 8 : 0,
        }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="flex flex-1 items-center overflow-hidden whitespace-nowrap"
      >
        <span className="text-[0.8125rem]">{label}</span>
        {shortcut && (
          <kbd className="ml-auto rounded border border-[var(--border-default)] bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
            {shortcut}
          </kbd>
        )}
      </motion.span>
    </button>
  );
}

export function ChatSidebar() {
  const [sidebarMode, setSidebarMode] =
    useState<SidebarDisplayMode>(DEFAULT_SIDEBAR_MODE);
  const [sidebarModeHydrated, setSidebarModeHydrated] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  useEffect(() => {
    // ponytail: defer state updates to avoid synchronous state transitions during mount
    setTimeout(() => {
      try {
        const saved = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
        if (saved === "full" || saved === "icon") {
          setSidebarMode(saved);
        }
      } catch {
        // localStorage unavailable, keep default
      }
      setSidebarModeHydrated(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!sidebarModeHydrated) return;
    try {
      localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, sidebarMode);
    } catch {
      // localStorage unavailable, ignore
    }
  }, [sidebarMode, sidebarModeHydrated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "b" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        const target = event.target;
        const isEditableTarget =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable);
        if (!isEditableTarget) {
          event.preventDefault();
          setSidebarMode((prev) => (prev === "icon" ? "full" : "icon"));
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { chatId, status, newChat, switchChat } = useChatContext();
  const [recents, setRecents] = useState<ChatMeta[]>([]);

  const isSidebarFull = sidebarMode === "full";
  const sidebarWidth = isSidebarFull ? SIDEBAR_FULL_WIDTH : SIDEBAR_ICON_WIDTH;

  // Load / refresh when expanded; again after a turn settles (new row / title bump).
  const streamReady = status === "ready";
  useEffect(() => {
    if (!isSidebarFull) return;
    let cancelled = false;
    void listChats()
      .then((chats) => {
        if (!cancelled) setRecents(chats);
      })
      .catch((err: unknown) => {
        console.error("listChats:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isSidebarFull, chatId, streamReady]);

  const handleNewChat = useCallback(() => {
    newChat();
  }, [newChat]);

  const handleOpenRecent = useCallback(
    (id: string) => {
      void switchChat(id).catch((err: unknown) => {
        console.error("switchChat:", err);
      });
    },
    [switchChat],
  );

  const handleOpenSettings = useCallback(() => {
    setSettingsDialogOpen(true);
  }, []);

  const handleToggleSidebarMode = useCallback(() => {
    setSidebarMode((prev) => (prev === "icon" ? "full" : "icon"));
  }, []);

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={SIDEBAR_SPRING}
        className="relative z-20 flex h-full flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-elevated)]/85 backdrop-blur-md"
        aria-label="Conversation navigation"
      >
        {/* Top: expand/collapse toggle — centered when collapsed, right when expanded */}
        <div
          className={cn(
            "flex items-center px-3 py-3",
            isSidebarFull ? "justify-end" : "justify-center",
          )}
        >
          <button
            onClick={handleToggleSidebarMode}
            className={cn(
              "flex size-8 items-center justify-center rounded-[var(--radius)] transition-all duration-200 outline-none",
              "text-text-primary hover:bg-[var(--surface-hover)]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
            aria-label={
              isSidebarFull ? "Collapse to icons" : "Expand sidebar"
            }
          >
            {isSidebarFull ? (
              <DotMatrixIcon name="panelLeftClose" size={ICON_GLYPH.toolbar} />
            ) : (
              <DotMatrixIcon name="panelLeftOpen" size={ICON_GLYPH.toolbar} />
            )}
          </button>
        </div>

        {/* Action items — partial top rule grows with expand (icon → content width) */}
        <div
          className={cn(
            "relative flex flex-col gap-1.5 px-3 py-3",
            "before:pointer-events-none before:absolute before:top-0 before:h-px",
            "before:left-3 before:right-auto before:origin-left",
            "before:bg-[var(--accent-border)] before:content-['']",
            "before:transition-[width] before:duration-300 before:ease-out",
            // Length↔length only (w-auto cannot reverse-tween on collapse)
            isSidebarFull ? "before:w-[calc(100%-1.5rem)]" : "before:w-8",
          )}
        >
          <SidebarItem
            icon={(props) => <DotMatrixIcon name="plus" {...props} />}
            label="New chat"
            onClick={handleNewChat}
            showLabel={isSidebarFull}
            variant="primary"
          />
          {/* cloneElement wires onClick onto SidebarItem (button) directly */}
          <CommandPalette
            placeholder="Search conversations, actions…"
            shortcutKey="k"
            trigger={
              <SidebarItem
                icon={(props) => <DotMatrixIcon name="search" {...props} />}
                label="Search…"
                onClick={() => {}}
                shortcut="⌘K"
                showLabel={isSidebarFull}
              />
            }
          />
        </div>

        {/* Recents only when expanded — unmount when collapsed (no ghost DOM) */}
        {isSidebarFull ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="font-[family-name:var(--font-terminal)] text-[0.8125rem] font-medium uppercase tracking-[0.2em] text-text-secondary">
                Recents
              </span>
              <div className="h-px flex-1 bg-[var(--accent-border)]" />
            </div>
            {recents.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-3">
                <span className="text-sm text-text-secondary">
                  No conversations yet
                </span>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
                {recents.map((chat) => {
                  const active = chat.id === chatId;
                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => handleOpenRecent(chat.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full truncate rounded-[var(--radius)] px-2 py-1.5 text-left text-[0.8125rem] outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active
                          ? "bg-[var(--surface-focus)] text-text-primary"
                          : "text-text-primary hover:bg-[var(--surface-hover)]",
                      )}
                      title={chat.title}
                    >
                      {chat.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1" aria-hidden />
        )}

        {/* Footer: Settings — partial top rule grows with expand (icon → content width) */}
        <div
          className={cn(
            "relative px-3 py-3",
            "before:pointer-events-none before:absolute before:top-0 before:h-px",
            "before:left-3 before:right-auto before:origin-left",
            "before:bg-[var(--accent-border)] before:content-['']",
            "before:transition-[width] before:duration-300 before:ease-out",
            // Length↔length only (w-auto cannot reverse-tween on collapse)
            isSidebarFull ? "before:w-[calc(100%-1.5rem)]" : "before:w-8",
          )}
        >
          <SidebarItem
            icon={(props) => <DotMatrixIcon name="settings" {...props} />}
            label="Settings"
            onClick={handleOpenSettings}
            active={settingsDialogOpen}
            showLabel={isSidebarFull}
          />
        </div>
      </motion.aside>

      <SettingsDialog
        onOpenChange={setSettingsDialogOpen}
        open={settingsDialogOpen}
      />
    </>
  );
}
