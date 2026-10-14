import type { ReactNode } from "react";
import { ChatSidebarRail } from "../chrome/rail";

export function ChatSidebarFooter({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-col gap-1.5 px-3 py-3">
      <ChatSidebarRail />
      {children}
    </div>
  );
}
