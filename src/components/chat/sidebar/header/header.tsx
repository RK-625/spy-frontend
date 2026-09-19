"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_GLYPH } from "@/lib/icon-tokens";

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
          <PanelLeftClose size={ICON_GLYPH.toolbar} strokeWidth={1.5} />
        ) : (
          <PanelLeftOpen size={ICON_GLYPH.toolbar} strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}
