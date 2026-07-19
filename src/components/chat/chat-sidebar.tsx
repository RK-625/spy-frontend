"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { CommandPalette } from "@/components/chat/command-palette";
import { SettingsDialog } from "@/components/chat/settings-dialog";
import { useChatContext } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { DotMatrixIcon } from "@/components/dotmatrix/icons";

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
        "group relative flex w-full items-center rounded-[var(--radius)] transition-all duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        !isPrimary &&
          !active &&
          "text-text-primary hover:bg-[var(--surface-hover)]",
        active && !isPrimary && "bg-[var(--surface-focus)] text-text-primary",
        isPrimary &&
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
          <kbd className="ml-auto rounded border border-[var(--border-default)] bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[#7a7685]">
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
        className="relative z-20 flex h-full flex-shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-elevated)]/85 backdrop-blur-md"
        aria-label="Conversation navigation"
      >
        {/* Top: expand/collapse toggle — centered when collapsed, right when expanded */}
        <div
          className={cn(
            "flex items-center px-3 py-3",
            isFull ? "justify-end" : "justify-center",
          )}
        >
          <button
            onClick={handleToggleMode}
            className={cn(
              "flex size-8 items-center justify-center rounded-[var(--radius)] transition-all duration-200 outline-none",
              "text-text-primary hover:bg-[var(--surface-hover)]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
            aria-label={isFull ? "Collapse to icons" : "Expand sidebar"}
          >
            {isFull ? (
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
            isFull ? "before:w-[calc(100%-1.5rem)]" : "before:w-8",
          )}
        >
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
                  "rounded-[var(--radius)] focus-within:ring-2 focus-within:ring-ring",
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

        {/* Recents only when expanded — unmount when collapsed (no ghost DOM) */}
        {isFull ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="font-[family-name:var(--font-terminal)] text-[0.8125rem] font-medium uppercase tracking-[0.2em] text-[#7a7685]">
                Recents
              </span>
              <div className="h-px flex-1 bg-[var(--accent-border)]" />
            </div>
            <div className="flex flex-1 items-center justify-center px-3">
              <span className="text-sm text-[#7a7685]">No conversations yet</span>
            </div>
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
            isFull ? "before:w-[calc(100%-1.5rem)]" : "before:w-8",
          )}
        >
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
