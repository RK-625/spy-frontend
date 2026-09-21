"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CommandPalette, SettingsDialog } from "../overlays";
import { useChatContext } from "@/contexts/ChatContext";
import { Book, Plus, Search, Settings, Waypoints } from "lucide-react";
import { ChatSidebarActions } from "./actions/actions";
import { ChatSidebarBody, ChatSidebarBodySpacer } from "./body/body";
import { ChatSidebarItem } from "./chrome/item";
import { ChatSidebarFooter } from "./footer/footer";
import { ChatSidebarHeader } from "./header/header";
import { ChatSidebarNotes } from "./notes/notes";
import { ChatSidebarRecents } from "./recents/recents";

type SidebarDisplayMode = "icon" | "full";
type SidebarPanel = "chats" | "notes";
const SIDEBAR_MODE_STORAGE_KEY = "spy-sidebar-mode";
const SIDEBAR_PANEL_STORAGE_KEY = "spy-sidebar-panel";
const DEFAULT_SIDEBAR_MODE: SidebarDisplayMode = "icon";
const DEFAULT_SIDEBAR_PANEL: SidebarPanel = "chats";

const SIDEBAR_ICON_WIDTH = 56;
const SIDEBAR_FULL_WIDTH = 240;
const SIDEBAR_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 32,
};

const SIDEBAR_CHROME_TRANSITION = { duration: 0.15, ease: "easeOut" } as const;
const SIDEBAR_CHROME_MOTION = {
  initial: { opacity: 0, x: -8, y: -4, height: 0 },
  animate: { opacity: 1, x: 0, y: 0, height: "auto" },
  exit: { opacity: 0, x: -8, y: -4, height: 0 },
} as const;

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
  const [sidebarPanel, setSidebarPanel] =
    useState<SidebarPanel>(DEFAULT_SIDEBAR_PANEL);
  const [sidebarPanelHydrated, setSidebarPanelHydrated] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    // ponytail: defer state updates to avoid synchronous state transitions during mount
    setTimeout(() => {
      try {
        const savedMode = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
        if (savedMode === "full" || savedMode === "icon") {
          setSidebarMode(savedMode);
        }
        const savedPanel = localStorage.getItem(SIDEBAR_PANEL_STORAGE_KEY);
        if (savedPanel === "chats" || savedPanel === "notes") {
          setSidebarPanel(savedPanel);
        }
      } catch {
        // localStorage unavailable, keep default
      }
      setSidebarModeHydrated(true);
      setSidebarPanelHydrated(true);
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
    if (!sidebarPanelHydrated) return;
    try {
      localStorage.setItem(SIDEBAR_PANEL_STORAGE_KEY, sidebarPanel);
    } catch {
      // localStorage unavailable, ignore
    }
  }, [sidebarPanel, sidebarPanelHydrated]);

  const { newChat, setSelectedNote } = useChatContext();
  const router = useRouter();
  const pathname = usePathname();

  const isNotesPanel = sidebarPanel === "notes";
  const isSidebarFull = sidebarMode === "full" || isNotesPanel;
  const sidebarWidth = isSidebarFull ? SIDEBAR_FULL_WIDTH : SIDEBAR_ICON_WIDTH;

  const handleNewChat = useCallback(() => {
    newChat();
    setSidebarPanel("chats");
  }, [newChat]);

  const handleOpenGraph = useCallback(() => {
    router.push("/graph");
  }, [router]);

  const handleRevealNotes = useCallback(() => {
    setSidebarPanel("notes");
    setSidebarMode("full");
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsDialogOpen(true);
  }, []);

  const handleOpenCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  const handleDismissNotes = useCallback(() => {
    setSidebarPanel("chats");
    setSidebarMode("icon");
    setSelectedNote(null);
  }, [setSelectedNote]);

  const handleToggleSidebarMode = useCallback(() => {
    if (sidebarPanel === "notes") {
      handleDismissNotes();
      return;
    }
    setSidebarMode((prev) => (prev === "icon" ? "full" : "icon"));
  }, [handleDismissNotes, sidebarPanel]);

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
          handleToggleSidebarMode();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleSidebarMode]);

  return (
    <>
      <ChatSidebarFrame width={sidebarWidth}>
        <ChatSidebarHeader
          isSidebarFull={isSidebarFull}
          onToggleSidebarMode={handleToggleSidebarMode}
        />
        <ChatSidebarBody>
          <AnimatePresence initial={false}>
            {!isNotesPanel ? (
              <motion.div
                key="sidebar-chats-actions"
                initial={SIDEBAR_CHROME_MOTION.initial}
                animate={SIDEBAR_CHROME_MOTION.animate}
                exit={SIDEBAR_CHROME_MOTION.exit}
                transition={SIDEBAR_CHROME_TRANSITION}
                className="overflow-hidden"
              >
                <ChatSidebarActions isSidebarFull={isSidebarFull}>
                  <ChatSidebarItem
                    icon={(props) => <Plus {...props} strokeWidth={1.5} />}
                    label="New chat"
                    onClick={handleNewChat}
                    showLabel={isSidebarFull}
                    variant="primary"
                  />
                  <ChatSidebarItem
                    icon={(props) => <Search {...props} strokeWidth={1.5} />}
                    label="Search…"
                    onClick={handleOpenCommandPalette}
                    shortcut="⌘K"
                    showLabel={isSidebarFull}
                  />
                  <ChatSidebarItem
                    icon={(props) => <Waypoints {...props} strokeWidth={1.5} />}
                    label="Graph"
                    onClick={handleOpenGraph}
                    active={pathname === "/graph"}
                    showLabel={isSidebarFull}
                  />
                  <ChatSidebarItem
                    icon={(props) => <Book {...props} strokeWidth={1.5} />}
                    label="Notes"
                    onClick={handleRevealNotes}
                    showLabel={isSidebarFull}
                  />
                </ChatSidebarActions>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {isSidebarFull ? (
            isNotesPanel ? (
              <ChatSidebarNotes />
            ) : (
              <ChatSidebarRecents />
            )
          ) : (
            <ChatSidebarBodySpacer />
          )}
        </ChatSidebarBody>
        <AnimatePresence initial={false}>
          {!isNotesPanel ? (
            <motion.div
              key="sidebar-chats-footer"
              initial={SIDEBAR_CHROME_MOTION.initial}
              animate={SIDEBAR_CHROME_MOTION.animate}
              exit={SIDEBAR_CHROME_MOTION.exit}
              transition={SIDEBAR_CHROME_TRANSITION}
              className="overflow-hidden"
            >
              <ChatSidebarFooter isSidebarFull={isSidebarFull}>
                <ChatSidebarItem
                  icon={(props) => <Settings {...props} strokeWidth={1.5} />}
                  label="Settings"
                  onClick={handleOpenSettings}
                  active={settingsDialogOpen}
                  showLabel={isSidebarFull}
                />
              </ChatSidebarFooter>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </ChatSidebarFrame>
      <CommandPalette
        onOpenChange={setCommandPaletteOpen}
        open={commandPaletteOpen}
        placeholder="Search conversations, actions…"
        shortcutKey="k"
        trigger={null}
      />
      <SettingsDialog
        onOpenChange={setSettingsDialogOpen}
        open={settingsDialogOpen}
      />
    </>
  );
}
