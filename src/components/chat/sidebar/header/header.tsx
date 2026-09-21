"use client";

import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { Button } from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import { cn } from "@/lib/utils";

const HEADER_CONTROL_CLASS = cn(
  "rounded-[var(--radius)] text-text-primary",
  "hover:bg-[var(--surface-hover)] hover:text-text-primary",
  "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring",
  "active:translate-y-0 active:not-aria-[haspopup]:translate-y-0",
);

export function ChatSidebarHeader({
  isSidebarFull,
  onToggleSidebarMode,
  onOpenCommandPalette,
}: {
  isSidebarFull: boolean;
  onToggleSidebarMode: () => void;
  onOpenCommandPalette: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const chromeTransition = reducedMotion ? { duration: 0 } : MOTION.chrome;
  const collapseGlyph = isSidebarFull ? (
    <motion.span
      key="sidebar-collapse-close"
      className="absolute inset-0"
      initial={CHROME_FADE.initial}
      animate={CHROME_FADE.animate}
      exit={CHROME_FADE.exit}
      transition={chromeTransition}
    >
      <PanelLeftClose
        size={ICON_GLYPH.toolbar}
        strokeWidth={1.5}
        className="size-5"
      />
    </motion.span>
  ) : (
    <motion.span
      key="sidebar-collapse-open"
      className="absolute inset-0"
      initial={CHROME_FADE.initial}
      animate={CHROME_FADE.animate}
      exit={CHROME_FADE.exit}
      transition={chromeTransition}
    >
      <PanelLeftOpen
        size={ICON_GLYPH.toolbar}
        strokeWidth={1.5}
        className="size-5"
      />
    </motion.span>
  );

  return (
    <div className="relative flex items-center px-3 py-3">
      <AnimatePresence initial={false}>
        {isSidebarFull ? (
          <motion.span
            key="sidebar-wordmark"
            initial={CHROME_FADE.initial}
            animate={CHROME_FADE.animate}
            exit={CHROME_FADE.exit}
            transition={chromeTransition}
            className="absolute top-1/2 left-3 -translate-y-1/2 font-[family-name:var(--font-terminal)] text-lg font-bold tracking-widest text-text-primary uppercase"
          >
            SPY
          </motion.span>
        ) : null}
      </AnimatePresence>
      <div className="relative ml-auto">
        <AnimatePresence initial={false}>
          {isSidebarFull ? (
            <motion.div
              key="sidebar-header-search"
              className="absolute right-full mr-2"
              initial={CHROME_FADE.initial}
              animate={CHROME_FADE.animate}
              exit={CHROME_FADE.exit}
              transition={chromeTransition}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onOpenCommandPalette}
                className={HEADER_CONTROL_CLASS}
                aria-label="Search"
              >
                <Search
                  size={ICON_GLYPH.toolbar}
                  strokeWidth={1.5}
                  className="size-5"
                />
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebarMode}
          className={HEADER_CONTROL_CLASS}
          aria-label={isSidebarFull ? "Collapse to icons" : "Expand sidebar"}
        >
          <span className="relative size-5">
            <AnimatePresence initial={false}>{collapseGlyph}</AnimatePresence>
          </span>
        </Button>
      </div>
    </div>
  );
}
