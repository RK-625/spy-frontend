"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ChatSidebar,
  PromptInputProvider,
} from "@/components/chat";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { AppToaster, TooltipProvider } from "@/components/ui";
import { ChatProvider, useChatContext } from "@/contexts/ChatContext";
import { CHROME_FADE, MOTION } from "@/lib/motion";

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
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const chromeTransition = reducedMotion ? { duration: 0 } : MOTION.chrome;

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-chat workspace-root">
      <div className="relative z-10 flex h-screen w-full">
        <TooltipProvider delayDuration={300}>
          <ChatProvider>
            <WorkspacePromptProvider>
              <ChatSidebar />
              <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="pointer-events-none absolute inset-0 z-50 bg-surface-chat animate-[dissolve-out_2.5s_linear_0.8s_forwards]" />
                <AnimatePresence initial={false}>
                  <motion.div
                    key={pathname}
                    className="absolute inset-0 flex min-h-0 min-w-0 flex-col"
                    initial={CHROME_FADE.initial}
                    animate={CHROME_FADE.animate}
                    exit={CHROME_FADE.exit}
                    transition={chromeTransition}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </div>
            </WorkspacePromptProvider>
          </ChatProvider>
          <AppToaster />
        </TooltipProvider>
      </div>
    </div>
  );
}
