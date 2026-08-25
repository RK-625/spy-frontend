"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { CommandPalette, SettingsDialog } from "../overlays";
import { useChatContext } from "@/contexts/ChatContext";
import { DotMatrixIcon } from "@/components/dotmatrix";
import { ChatSidebarActions } from "./actions/actions";
import { ChatSidebarBody, ChatSidebarBodySpacer } from "./body/body";
import { ChatSidebarItem } from "./chrome/item";
import { ChatSidebarFooter } from "./footer/footer";
import { ChatSidebarHeader } from "./header/header";
import { ChatSidebarRecents } from "./recents/recents";

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

function ChatSidebarFrame({
  width,
  children,
}: {
  width: number;
  children: ReactNode;
}) {
  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={SIDEBAR_SPRING}
      className="relative z-20 flex h-full flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-elevated)]/85 backdrop-blur-md"
      aria-label="Conversation navigation"
    >
      {children}
    </motion.aside>
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

  const { newChat } = useChatContext();

  const isSidebarFull = sidebarMode === "full";
  const sidebarWidth = isSidebarFull ? SIDEBAR_FULL_WIDTH : SIDEBAR_ICON_WIDTH;

  const handleNewChat = useCallback(() => {
    newChat();
  }, [newChat]);

  const handleOpenGraph = useCallback(() => {}, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsDialogOpen(true);
  }, []);

  const handleToggleSidebarMode = useCallback(() => {
    setSidebarMode((prev) => (prev === "icon" ? "full" : "icon"));
  }, []);

  return (
    <>
      <ChatSidebarFrame width={sidebarWidth}>
        <ChatSidebarHeader
          isSidebarFull={isSidebarFull}
          onToggleSidebarMode={handleToggleSidebarMode}
        />
        <ChatSidebarBody>
          <ChatSidebarActions isSidebarFull={isSidebarFull}>
            <ChatSidebarItem
              icon={(props) => <DotMatrixIcon name="plus" {...props} />}
              label="New chat"
              onClick={handleNewChat}
              showLabel={isSidebarFull}
              variant="primary"
            />
            {/* cloneElement wires onClick onto ChatSidebarItem (button) directly */}
            <CommandPalette
              placeholder="Search conversations, actions…"
              shortcutKey="k"
              trigger={
                <ChatSidebarItem
                  icon={(props) => <DotMatrixIcon name="search" {...props} />}
                  label="Search…"
                  onClick={() => {}}
                  shortcut="⌘K"
                  showLabel={isSidebarFull}
                />
              }
            />
            <ChatSidebarItem
              icon={(props) => <DotMatrixIcon name="graph" {...props} />}
              label="Graph"
              onClick={handleOpenGraph}
              showLabel={isSidebarFull}
            />
          </ChatSidebarActions>
          {isSidebarFull ? (
            <ChatSidebarRecents isSidebarFull={isSidebarFull} />
          ) : (
            <ChatSidebarBodySpacer />
          )}
        </ChatSidebarBody>
        <ChatSidebarFooter isSidebarFull={isSidebarFull}>
          <ChatSidebarItem
            icon={(props) => <DotMatrixIcon name="settings" {...props} />}
            label="Settings"
            onClick={handleOpenSettings}
            active={settingsDialogOpen}
            showLabel={isSidebarFull}
          />
        </ChatSidebarFooter>
      </ChatSidebarFrame>
      <SettingsDialog
        onOpenChange={setSettingsDialogOpen}
        open={settingsDialogOpen}
      />
    </>
  );
}
