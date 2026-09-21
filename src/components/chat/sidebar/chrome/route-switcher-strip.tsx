"use client";

import { Book, MessageSquare, Waypoints } from "lucide-react";
import { Button, ButtonGroup } from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";

function isNotesPathname(pathname: string): boolean {
  return pathname === "/notes" || pathname.startsWith("/notes/");
}

const ROUTE_SWITCHER_SLOT_CLASS = cn(
  "h-7 flex-1 rounded-[6px] p-0",
  "hover:bg-[var(--surface-hover)]",
  "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring",
  "active:translate-y-0 active:not-aria-[haspopup]:translate-y-0",
);

function routeSwitcherSlotTone(isActive: boolean): string {
  return isActive
    ? "bg-[var(--surface-focus)] text-[var(--secondary-foreground)] hover:text-[var(--secondary-foreground)]"
    : "text-text-secondary hover:text-text-secondary";
}

export function RouteSwitcherStrip({
  pathname,
  onOpenChat,
  onOpenNotes,
  onOpenGraph,
}: {
  pathname: string;
  onOpenChat: () => void;
  onOpenNotes: () => void;
  onOpenGraph: () => void;
}) {
  const chatActive = pathname === "/chat";
  const notesActive = isNotesPathname(pathname);
  const graphActive = pathname === "/graph";

  return (
    <ButtonGroup className="flex h-9 w-full items-center gap-1 rounded-[8px] bg-[var(--surface-chat)] p-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Chat"
        aria-current={chatActive ? "page" : undefined}
        onClick={onOpenChat}
        className={cn(
          ROUTE_SWITCHER_SLOT_CLASS,
          routeSwitcherSlotTone(chatActive),
        )}
      >
        <MessageSquare
          size={ICON_GLYPH.inline}
          strokeWidth={1.5}
          className="size-4"
        />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Notes"
        aria-current={notesActive ? "page" : undefined}
        onClick={onOpenNotes}
        className={cn(
          ROUTE_SWITCHER_SLOT_CLASS,
          routeSwitcherSlotTone(notesActive),
        )}
      >
        <Book size={ICON_GLYPH.inline} strokeWidth={1.5} className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Graph"
        aria-current={graphActive ? "page" : undefined}
        onClick={onOpenGraph}
        className={cn(
          ROUTE_SWITCHER_SLOT_CLASS,
          routeSwitcherSlotTone(graphActive),
        )}
      >
        <Waypoints
          size={ICON_GLYPH.inline}
          strokeWidth={1.5}
          className="size-4"
        />
      </Button>
    </ButtonGroup>
  );
}
