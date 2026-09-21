"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CommandPalette, SettingsDialog } from "../overlays";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { useChatContext } from "@/contexts/ChatContext";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import {
  Book,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Waypoints,
} from "lucide-react";
import { ChatSidebarActions } from "./actions/actions";
import { ChatSidebarBody, ChatSidebarBodySpacer } from "./body/body";
import { ChatSidebarItem } from "./chrome/item";
import { SwitcherDivider } from "./chrome/rail";
import { RouteSwitcherStrip } from "./chrome/route-switcher-strip";
import { ChatSidebarFooter } from "./footer/footer";
import { ChatSidebarHeader } from "./header/header";
import { ChatSidebarNotes } from "./notes/notes";
import { ChatSidebarRecents } from "./recents/recents";

type SidebarDisplayMode = "icon" | "full";
const SIDEBAR_MODE_STORAGE_KEY = "spy-sidebar-mode";
const DEFAULT_SIDEBAR_MODE: SidebarDisplayMode = "icon";

function isNotesPathname(pathname: string): boolean {
  return pathname === "/notes" || pathname.startsWith("/notes/");
}

const SIDEBAR_ICON_WIDTH = 56;
const SIDEBAR_FULL_WIDTH = 240;

const SIDEBAR_CHROME_MOTION = {
  initial: { opacity: 0, x: -8, y: -4, height: 0 },
  animate: { opacity: 1, x: 0, y: 0, height: "auto" },
  exit: { opacity: 0, x: -8, y: -4, height: 0 },
} as const;

const CHROME_LAYER = CHROME_FADE;

function ChatSidebarFrame({
  width,
  reducedMotion,
  children,
}: {
  width: number;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={reducedMotion ? { duration: 0 } : MOTION.spring}
      className="relative z-20 flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-elevated)]/85 backdrop-blur-md"
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    // ponytail: defer state updates to avoid synchronous state transitions during mount
    setTimeout(() => {
      try {
        const savedMode = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
        if (savedMode === "full" || savedMode === "icon") {
          setSidebarMode(savedMode);
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

  const { newChat } = useChatContext();
  const router = useRouter();
  const pathname = usePathname();

  const isChatRoute = pathname === "/chat";
  const isNotesRoute = isNotesPathname(pathname);
  const isGraphRoute = pathname === "/graph";
  const isSidebarFull = sidebarMode === "full";
  const sidebarWidth = isSidebarFull ? SIDEBAR_FULL_WIDTH : SIDEBAR_ICON_WIDTH;
  const reducedMotion = usePrefersReducedMotion();
  const chromeTransition = reducedMotion ? { duration: 0 } : MOTION.chrome;

  const handleNewChat = useCallback(() => {
    newChat();
  }, [newChat]);

  // Chat tab reuses the live Chat instance; Plus is the only mint.
  const handleOpenChat = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const handleOpenNotes = useCallback(() => {
    if (isNotesPathname(pathname)) return;
    router.push("/notes");
  }, [pathname, router]);

  const handleOpenGraph = useCallback(() => {
    if (pathname === "/graph") return;
    router.push("/graph");
  }, [pathname, router]);

  const handleOpenSettings = useCallback(() => {
    setSettingsDialogOpen(true);
  }, []);

  const handleOpenCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  const handleToggleSidebarMode = useCallback(() => {
    setSidebarMode((prev) => (prev === "icon" ? "full" : "icon"));
  }, []);

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
      <ChatSidebarFrame width={sidebarWidth} reducedMotion={reducedMotion}>
        <ChatSidebarHeader
          isSidebarFull={isSidebarFull}
          onToggleSidebarMode={handleToggleSidebarMode}
          onOpenCommandPalette={handleOpenCommandPalette}
        />
        <ChatSidebarBody>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false}>
              {isSidebarFull ? (
                <motion.div
                  key="sidebar-body-full"
                  className="absolute top-0 left-0 flex h-full min-h-0 flex-col overflow-hidden"
                  style={{ width: SIDEBAR_FULL_WIDTH }}
                  initial={CHROME_LAYER.initial}
                  animate={CHROME_LAYER.animate}
                  exit={CHROME_LAYER.exit}
                  transition={chromeTransition}
                >
                  <div className="flex flex-col gap-1.5 px-3 py-3">
                    <RouteSwitcherStrip
                      pathname={pathname}
                      onOpenChat={handleOpenChat}
                      onOpenNotes={handleOpenNotes}
                      onOpenGraph={handleOpenGraph}
                    />
                  </div>
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    <AnimatePresence initial={false}>
                      {isChatRoute ? (
                        <motion.div
                          key="sidebar-xor-chat"
                          className="absolute inset-0 flex min-h-0 flex-col"
                          initial={CHROME_LAYER.initial}
                          animate={CHROME_LAYER.animate}
                          exit={CHROME_LAYER.exit}
                          transition={chromeTransition}
                        >
                          <div className="flex flex-col gap-1.5 px-3 pb-1">
                            <ChatSidebarItem
                              icon={(props) => (
                                <Plus {...props} strokeWidth={1.5} />
                              )}
                              label="New chat"
                              onClick={handleNewChat}
                              showLabel
                              variant="primary"
                            />
                          </div>
                          <ChatSidebarRecents />
                        </motion.div>
                      ) : isNotesRoute ? (
                        <motion.div
                          key="sidebar-xor-notes"
                          className="absolute inset-0 flex min-h-0 flex-col"
                          initial={CHROME_LAYER.initial}
                          animate={CHROME_LAYER.animate}
                          exit={CHROME_LAYER.exit}
                          transition={chromeTransition}
                        >
                          <ChatSidebarNotes />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="sidebar-xor-graph"
                          className="absolute inset-0 flex min-h-0 flex-col"
                          initial={CHROME_LAYER.initial}
                          animate={CHROME_LAYER.animate}
                          exit={CHROME_LAYER.exit}
                          transition={chromeTransition}
                        >
                          <ChatSidebarBodySpacer />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="sidebar-body-icon"
                  className="absolute top-0 left-0 flex h-full min-h-0 flex-col overflow-hidden"
                  style={{ width: SIDEBAR_ICON_WIDTH }}
                  initial={CHROME_LAYER.initial}
                  animate={CHROME_LAYER.animate}
                  exit={CHROME_LAYER.exit}
                  transition={chromeTransition}
                >
                  <ChatSidebarActions>
                    <ChatSidebarItem
                      icon={(props) => (
                        <MessageSquare {...props} strokeWidth={1.5} />
                      )}
                      label="Chat"
                      onClick={handleOpenChat}
                      active={isChatRoute}
                      showLabel={false}
                    />
                    <ChatSidebarItem
                      icon={(props) => <Book {...props} strokeWidth={1.5} />}
                      label="Notes"
                      onClick={handleOpenNotes}
                      active={isNotesRoute}
                      showLabel={false}
                    />
                    <ChatSidebarItem
                      icon={(props) => (
                        <Waypoints {...props} strokeWidth={1.5} />
                      )}
                      label="Graph"
                      onClick={handleOpenGraph}
                      active={isGraphRoute}
                      showLabel={false}
                    />
                    <AnimatePresence initial={false}>
                      {isChatRoute ? (
                        <motion.div
                          key="sidebar-chat-extras"
                          initial={SIDEBAR_CHROME_MOTION.initial}
                          animate={SIDEBAR_CHROME_MOTION.animate}
                          exit={SIDEBAR_CHROME_MOTION.exit}
                          transition={chromeTransition}
                          className="flex flex-col gap-1.5 overflow-hidden"
                        >
                          <SwitcherDivider />
                          <ChatSidebarItem
                            icon={(props) => (
                              <Plus {...props} strokeWidth={1.5} />
                            )}
                            label="New chat"
                            onClick={handleNewChat}
                            showLabel={false}
                            variant="primary"
                          />
                          <ChatSidebarItem
                            icon={(props) => (
                              <Search {...props} strokeWidth={1.5} />
                            )}
                            label="Search"
                            onClick={handleOpenCommandPalette}
                            shortcut="⌘K"
                            showLabel={false}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </ChatSidebarActions>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ChatSidebarBody>
        <ChatSidebarFooter>
          <ChatSidebarItem
            icon={(props) => <Settings {...props} strokeWidth={1.5} />}
            label="Settings"
            onClick={handleOpenSettings}
            active={settingsDialogOpen}
            showLabel={isSidebarFull}
          />
        </ChatSidebarFooter>
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
