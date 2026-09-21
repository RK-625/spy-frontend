import type { ReactNode } from "react";

export function ChatSidebarActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5 px-3 py-3">{children}</div>;
}
