"use client";

import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { ChatContextValue } from "@/types/chat";
import { TooltipProvider } from "@/components/ui";

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Stream-only chat provider. Owns useChat transport + messages/status.
 * Model/mode/web prefs and submit live on PromptInputProvider / PromptInputWorkspace.
 */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { messages, status, stop, sendMessage, error, setMessages, addToolOutput } =
    useChat<UIMessage>({
      id: "spy-chat",
      experimental_throttle: 50,
      transport: new DefaultChatTransport({
        api: "/api/chat",
      }),
      messages: [] as UIMessage[],
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
      addToolOutput,
    }),
    [
      status,
      messages,
      clearMessages,
      error,
      stop,
      sendMessage,
      addToolOutput,
    ],
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
