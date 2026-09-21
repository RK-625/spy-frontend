"use client";

import type { ReactNode } from "react";
import {
  ChatSidebar,
  PromptInputProvider,
} from "@/components/chat";
import { AppToaster, TooltipProvider } from "@/components/ui";
import { ChatProvider, useChatContext } from "@/contexts/ChatContext";

function WorkspacePromptProvider({ children }: { children: ReactNode }) {
  const { chatId } = useChatContext();
  return (
    <PromptInputProvider chatId={chatId}>{children}</PromptInputProvider>
  );
}

export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-chat workspace-root">
      <div className="relative z-10 flex h-screen w-full">
        <TooltipProvider delayDuration={300}>
          <ChatProvider>
            <WorkspacePromptProvider>
              <ChatSidebar />
              <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="pointer-events-none absolute inset-0 z-50 bg-surface-chat animate-[dissolve-out_2.5s_linear_0.8s_forwards]" />
                {children}
              </div>
            </WorkspacePromptProvider>
          </ChatProvider>
          <AppToaster />
        </TooltipProvider>
      </div>
    </div>
  );
}
