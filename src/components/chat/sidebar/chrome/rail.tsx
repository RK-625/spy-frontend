import { cn } from "@/lib/utils";

export function ChatSidebarRail({
  isSidebarFull,
}: {
  isSidebarFull: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-0 left-3 h-px origin-left",
        "bg-[var(--accent-border)]",
        "transition-[width] duration-300 ease-out",
        // Length↔length only (w-auto cannot reverse-tween on collapse)
        isSidebarFull ? "w-[calc(100%-1.5rem)]" : "w-8",
      )}
    />
  );
}
