"use client";

import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { createContext, useCallback, useContext, useState } from "react";
import { ChatContextValue } from "@/types";
import { toast } from "sonner";
import type { PromptInputMessage } from "@/components/chat/ai-elements/prompt-input";

const ChatContext = createContext<ChatContextValue | null>(null); // defining the bucket

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useState<string>("deepseek-v4-flash");
  const [mode, setMode] = useState<string>("high");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(true);

  const { messages, status, stop, sendMessage, error, setMessages, addToolOutput } =
    useChat<UIMessage>({
      id: "spy-chat",
      experimental_throttle: 50,
      transport: new DefaultChatTransport({
        api: "/api/chat",
      }),
      messages: [] as UIMessage[],
    });

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (status !== "ready") return;

      const hasText = Boolean(message.text?.trim());
      const hasAttachments = Boolean(message.files?.length);

      if (!hasText && !hasAttachments) {
        return;
      }
      try {
        await sendMessage(
          {
            text: message.text?.trim() || "",
            files:
              message.files && message.files.length > 0
                ? message.files
                : undefined,
          },
          {
            body: { model, useWebSearch, mode },
          },
        );
      } catch (e) {
        console.error(e);
      }
    },
    [sendMessage, status, model, useWebSearch, mode],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);

  const value: ChatContextValue = {
    model,
    setModel,
    mode,
    setMode,
    modelSelectorOpen,
    setModelSelectorOpen,
    modeSelectorOpen,
    setModeSelectorOpen,

    useWebSearch,
    setUseWebSearch,
    status,
    messages,
    toggleWebSearch,
    clearMessages,
    error,
    handleSubmit,
    stop,
    sendMessage,
    addToolOutput,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return ctx;
}
