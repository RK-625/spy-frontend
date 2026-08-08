"use client";

import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { ChatContextValue } from "@/types/chat";
import { TooltipProvider } from "@/components/ui";

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Stream-only chat provider. Owns useChat transport + messages/status.
 * Model/mode/web prefs and submit live on PromptInputProvider / PromptInputWorkspace.
 * Tooltip chrome folded in (was ChatProviderWrapper).
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { messages, status, stop, sendMessage, error, setMessages } =
    useChat<UIMessage>({
      id: "spy-chat",
      experimental_throttle: 50,
      transport: new DefaultChatTransport({
        api: "/api/chat",
      }),
    });

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const value: ChatContextValue = useMemo(
    () => ({
      status,
      messages,
      clearMessages,
      error,
      stop,
      sendMessage,
    }),
    [status, messages, clearMessages, error, stop, sendMessage],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
    </TooltipProvider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return ctx;
}
