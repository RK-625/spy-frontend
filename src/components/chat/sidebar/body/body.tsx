import type { ReactNode } from "react";

export function ChatSidebarBody({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}

export function ChatSidebarBodySpacer() {
  return <div className="min-h-0 flex-1" aria-hidden />;
}
