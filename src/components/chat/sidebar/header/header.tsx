"use client";

import { cn } from "@/lib/utils";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { DotMatrixIcon } from "@/components/dotmatrix";

export function ChatSidebarHeader({
  isSidebarFull,
  onToggleSidebarMode,
}: {
  isSidebarFull: boolean;
  onToggleSidebarMode: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center px-3 py-3",
        isSidebarFull ? "justify-end" : "justify-center",
      )}
    >
      <button
        onClick={onToggleSidebarMode}
        className={cn(
          "flex size-8 items-center justify-center rounded-[var(--radius)] transition-all duration-200 outline-none",
          "text-text-primary hover:bg-[var(--surface-hover)]",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        )}
        aria-label={isSidebarFull ? "Collapse to icons" : "Expand sidebar"}
      >
        {isSidebarFull ? (
          <DotMatrixIcon name="panelLeftClose" size={ICON_GLYPH.toolbar} />
        ) : (
          <DotMatrixIcon name="panelLeftOpen" size={ICON_GLYPH.toolbar} />
        )}
      </button>
    </div>
  );
}
