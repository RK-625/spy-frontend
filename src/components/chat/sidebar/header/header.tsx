"use client";

import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ICON_GLYPH } from "@/lib/icon-tokens";

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
  const collapseControl = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onToggleSidebarMode}
      className={HEADER_CONTROL_CLASS}
      aria-label={isSidebarFull ? "Collapse to icons" : "Expand sidebar"}
    >
      {isSidebarFull ? (
        <PanelLeftClose
          size={ICON_GLYPH.toolbar}
          strokeWidth={1.5}
          className="size-5"
        />
      ) : (
        <PanelLeftOpen
          size={ICON_GLYPH.toolbar}
          strokeWidth={1.5}
          className="size-5"
        />
      )}
    </Button>
  );

  return (
    <div
      className={cn(
        "flex items-center px-3 py-3",
        isSidebarFull ? "justify-between" : "justify-center",
      )}
    >
      {isSidebarFull ? (
        <>
          <span className="font-[family-name:var(--font-terminal)] text-lg font-bold tracking-widest text-text-primary uppercase">
            SPY
          </span>
          <div className="flex items-center gap-2">
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
            {collapseControl}
          </div>
        </>
      ) : (
        collapseControl
      )}
    </div>
  );
}
