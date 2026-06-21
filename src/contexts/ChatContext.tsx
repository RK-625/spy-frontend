"use client";

import type { TextUIPart, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { createContext, useCallback, useContext, useState } from "react";
import { ChatContextValue } from "@/types";

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useState<string>("gpt-4o");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [textPart, setTextPart] = useState<TextUIPart>({
    text: "",
    type: "text",
  });

  const { messages, status, stop, sendMessage, error, setMessages } =
    useChat<UIMessage>({
      id: "spy-chat",
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      messages: [] as UIMessage[],
    });

  const handleSubmit = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!textPart.text.trim()) return;
      sendMessage({
        role: "user",
        parts: [textPart],
      });
      setTextPart((prev) => ({ ...prev, text: "" }));
    },
    [textPart, sendMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setTextPart((prev) => ({ ...prev, text: "" }));
  }, [setMessages, setTextPart]);

  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);

  const value: ChatContextValue = {
    model,
    setModel,
    modelSelectorOpen,
    setModelSelectorOpen,
    textPart,
    setTextPart,
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
