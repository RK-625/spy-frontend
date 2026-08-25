import type { ReactNode } from "react";
import { ChatSidebarRail } from "../chrome/rail";

export function ChatSidebarFooter({
  isSidebarFull,
  children,
}: {
  isSidebarFull: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative px-3 py-3">
      <ChatSidebarRail isSidebarFull={isSidebarFull} />
      {children}
    </div>
  );
}
