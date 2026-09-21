"use client";

import type { ComponentType } from "react";
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { MOTION } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ChatSidebarItemProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  shortcut?: string;
  active?: boolean;
  showLabel: boolean;
  variant?: "primary" | "default";
}

export function ChatSidebarItem({
  icon: Icon,
  label,
  onClick,
  shortcut,
  active = false,
  showLabel,
  variant = "default",
}: ChatSidebarItemProps) {
  const isPrimaryVariant = variant === "primary";
  const reducedMotion = usePrefersReducedMotion();

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group relative flex w-full items-center overflow-hidden rounded-[var(--radius)] transition-[background-color,color] duration-fast ease-chrome outline-none",
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
        animate={{ opacity: showLabel ? 1 : 0 }}
        transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
        className="ml-2 flex flex-1 items-center overflow-hidden whitespace-nowrap"
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
