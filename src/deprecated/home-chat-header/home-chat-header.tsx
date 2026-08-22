"use client";

/**
 * Archived: former `/home` chat panel header (SPY / WEAVING SIGNAL).
 * Not used by production routes. Do not import from `@/deprecated`.
 */

import ShinyText from "@/components/landing/shiny-text";

export function HomeChatHeader() {
  return (
    <header className="relative flex items-center gap-3 border-b border-[var(--border-subtle)] px-6 py-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lavender/15 to-transparent" />
      <ShinyText
        className="font-[family-name:var(--font-terminal)] text-lg font-bold tracking-widest uppercase"
        spread={120}
      >
        SPY
      </ShinyText>
      <span className="text-[0.65rem] font-[family-name:var(--font-terminal)] uppercase tracking-[0.3em] text-lavender">
        WEAVING SIGNAL
      </span>
    </header>
  );
}
