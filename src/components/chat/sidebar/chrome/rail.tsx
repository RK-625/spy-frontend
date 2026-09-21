import { Separator } from "@/components/ui";
import { cn } from "@/lib/utils";

// Length follows the aside both ways; do not switch to a fixed width on collapse.
export function ChatSidebarRail() {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-0 left-3 h-px w-[calc(100%-1.5rem)] origin-left",
        "bg-[var(--accent-border)]",
      )}
    />
  );
}

export function SwitcherDivider() {
  return <Separator className="bg-[var(--accent-border)]" />;
}
