"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { CommandPalette } from "@/components/ui/command-palette";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useChatContext } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { DotMatrixIcon } from "@/components/ai-elements/dot-matrix-icons";

type SidebarMode = "icon" | "full";
const STORAGE_KEY = "spy-sidebar-mode";
const DEFAULT_MODE: SidebarMode = "icon";

const ICON_WIDTH = 56;
const FULL_WIDTH = 240;
const SPRING = { type: "spring" as const, stiffness: 320, damping: 32 };

interface SidebarItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
  const isPrimary = variant === "primary";

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-2 transition-all duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[rgba(200,172,251,0.4)]",
        !isPrimary && !active && "text-[#9a8cc0] hover:bg-[rgba(200,172,251,0.08)] hover:text-[#e8e4df]",
        active && !isPrimary && "bg-[rgba(200,172,251,0.12)] text-[#e8dff8]",
        isPrimary && "text-[#e8dff8] font-medium text-[0.8125rem] hover:bg-[rgba(200,172,251,0.08)]",
      )}
    >
      <span className="flex-shrink-0">
        <Icon size={16} />
      </span>
      <motion.span
        initial={false}
        animate={{
          opacity: showLabel ? 1 : 0,
          width: showLabel ? "auto" : 0,
          marginLeft: showLabel ? 0 : 0,
        }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="flex flex-1 items-center overflow-hidden whitespace-nowrap"
      >
        <span className="text-[0.8125rem]">{label}</span>
        {shortcut && (
          <kbd className="ml-auto rounded border border-[rgba(200,172,251,0.15)] bg-[rgba(200,172,251,0.05)] px-1.5 py-0.5 font-mono text-[10px] text-[#7a7685]">
            {shortcut}
          </kbd>
        )}
      </motion.span>
    </button>
  );
}

export function ChatSidebar() {
  const [mode, setMode] = useState<SidebarMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // ponytail: defer state updates to avoid synchronous state transitions during mount
    setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "full" || saved === "icon") {
          setMode(saved);
        }
      } catch {
        // localStorage unavailable, keep default
      }
      setHydrated(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable, ignore
    }
  }, [mode, hydrated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "b" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        const target = event.target;
        const isEditable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable);
        if (!isEditable) {
          event.preventDefault();
          setMode((prev) => (prev === "icon" ? "full" : "icon"));
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { clearMessages } = useChatContext();

  const handleNewChat = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleToggleMode = useCallback(() => {
    setMode((prev) => (prev === "icon" ? "full" : "icon"));
  }, []);

  const isFull = mode === "full";

  const currentWidth = isFull ? FULL_WIDTH : ICON_WIDTH;

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: currentWidth }}
        transition={SPRING}
        className="relative z-20 flex h-full flex-shrink-0 flex-col border-r border-[rgba(200,172,251,0.08)] bg-[#0a0516]/85 backdrop-blur-md"
        aria-label="Conversation navigation"
      >
        {/* Top: expand/collapse toggle — centered when collapsed, right when expanded */}
        <div className={cn("flex items-center px-2 pt-3", isFull ? "justify-end" : "justify-center")}>
          <button
            onClick={handleToggleMode}
            className={cn(
              "flex size-10 items-center justify-center rounded-[var(--radius)] transition-all duration-200 outline-none",
              "text-[#9a8cc0] hover:bg-[rgba(200,172,251,0.08)] hover:text-[#e8e4df]",
              "focus-visible:ring-2 focus-visible:ring-[rgba(200,172,251,0.4)]"
            )}
            aria-label={isFull ? "Collapse to icons" : "Expand sidebar"}
          >
            {isFull ? <DotMatrixIcon name="panelLeftClose" size={16} /> : <DotMatrixIcon name="panelLeftOpen" size={16} />}
          </button>
        </div>

        <div className="mx-2 mt-3 h-px bg-[rgba(200,172,251,0.08)]" />

        {/* Action items */}
        <div className="flex flex-col gap-1 p-2">
          <SidebarItem
            icon={(props) => <DotMatrixIcon name="plus" {...props} />}
            label="New chat"
            onClick={handleNewChat}
            showLabel={isFull}
            variant="primary"
          />
          <CommandPalette
            showThemeGroup={false}
            placeholder="Search conversations, actions…"
            shortcutKey="k"
            trigger={
              <div
                className={cn(
                  "rounded-[var(--radius)] focus-within:ring-2 focus-within:ring-[rgba(200,172,251,0.4)]"
                )}
              >
                <SidebarItem
                  icon={(props) => <DotMatrixIcon name="search" {...props} />}
                  label="Search…"
                  onClick={() => {}}
                  shortcut="⌘K"
                  showLabel={isFull}
                />
              </div>
            }
          />
        </div>

        {/* Recents section — only show in full mode */}
        <motion.div
          initial={false}
          animate={{
            opacity: isFull ? 1 : 0,
            height: isFull ? "auto" : 0,
          }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <span className="font-[family-name:var(--font-terminal)] text-[0.8125rem] font-medium uppercase tracking-[0.2em] text-[#7a7685]">
              Recents
            </span>
            <div className="h-px flex-1 bg-[rgba(200,172,251,0.08)]" />
          </div>
          <div className="flex flex-1 items-center justify-center px-4">
            <span className="text-sm text-[#7a7685]">
              No conversations yet
            </span>
          </div>
        </motion.div>

        {/* Footer: Settings */}
        <div className="border-t border-[rgba(200,172,251,0.08)] p-2">
          <SidebarItem
            icon={(props) => <DotMatrixIcon name="settings" {...props} />}
            label="Settings"
            onClick={handleOpenSettings}
            active={settingsOpen}
            showLabel={isFull}
          />
        </div>
      </motion.aside>

      <SettingsDialog onOpenChange={setSettingsOpen} open={settingsOpen} />
    </>
  );
}
