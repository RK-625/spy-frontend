"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { findOppositeTheme, RESOLVED_THEME_ICON, useThemeSwitch } from "@/components/theme";
import { GLYPH_SWAP, MOTION } from "@/lib/motion";

/**
 * Shows the theme a click switches to (sun in dark, moon in light). Reads the theme itself so
 * it can be passed to `ChatSidebarItem` as a stable component and keep its swap animation.
 */
export function ThemeToggleGlyph({ size, className }: { size?: number; className?: string }) {
  const { resolvedTheme } = useThemeSwitch();
  const reducedMotion = usePrefersReducedMotion();
  const targetTheme = resolvedTheme ? findOppositeTheme(resolvedTheme) : undefined;
  const TargetIcon = targetTheme ? RESOLVED_THEME_ICON[targetTheme] : null;

  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <AnimatePresence initial={false}>
        {TargetIcon && (
          <motion.span
            key={targetTheme}
            className="absolute inset-0 flex items-center justify-center"
            initial={GLYPH_SWAP.initial}
            animate={GLYPH_SWAP.animate}
            exit={GLYPH_SWAP.exit}
            transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
          >
            <TargetIcon size={size} strokeWidth={1.5} className={className} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
