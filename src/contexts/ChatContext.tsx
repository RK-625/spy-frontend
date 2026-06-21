"use client";

import type { UIMessage, TextUIPart } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { createContext, useCallback, useContext, useState } from "react";
import { ChatMessage, ChatStatus, ChatContextValue } from "@/types";



const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  children,
  initialMessages = [],
}: {
  children: React.ReactNode;
  initialMessages?: ChatMessage[];
}) {
  const [model, setModel] = useState<string>("gpt-4o");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [text, setText] = useState<string>("");

  const {
    messages: aiMessages,
    status: aiStatus,
    stop,
    sendMessage,
    error: aiError,
    setMessages: setAiMessages,
  } = useChat<UIMessage>({
    id: "spy-chat",
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: initialMessages.map((m: ChatMessage): UIMessage => ({
      id: m.key,
      role: m.from === "user" ? "user" : "assistant",
      parts: [{ type: "text", text: m.versions[0]?.content || "" }]
    })) as UIMessage[],
  });

  const append = useCallback(
    async (message: UIMessage | Omit<UIMessage, "id">) => {
      // ponytail: resolves prompt from parts array
      const textPart = message.parts?.[0];
      const text = textPart && textPart.type === "text" ? textPart.text : undefined;
      if (text) sendMessage({ text });
      return null;
    },
    [sendMessage]
  );

  const handleSubmit = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!text.trim()) return;
      append({ 
        role: "user", 
        parts: [{ type: "text", text }] 
      });
      setText("");
    },
    [text, append, setText]
  );

  const status = aiStatus as ChatStatus;
  const error = aiError ? aiError.message : null;
  const messages: ChatMessage[] = aiMessages.map((msg: UIMessage) => {
    const original = initialMessages.find((m: ChatMessage) => m.key === msg.id);
    return {
      key: msg.id,
      from: msg.role === "user" ? "user" : "assistant",
      sources: original?.sources,
      reasoning: original?.reasoning,
      tools: original?.tools,
      versions: [
        {
          id: msg.id,
          content: msg.parts
            .filter((p): p is TextUIPart => p.type === "text")
            .map((p: TextUIPart) => p.text)
            .join("")
        }
      ],
    };
  });

  const clearMessages = useCallback(() => {
    setAiMessages([]);
    setText("");
  }, [setAiMessages, setText]);

  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);

  const value: ChatContextValue = {
    model,
    setModel,
    modelSelectorOpen,
    setModelSelectorOpen,
    text,
    setText,
    useWebSearch,
    setUseWebSearch,
    status,
    messages,
    clearMessages,
    toggleWebSearch,
    error,
    handleSubmit,
    stop,
    append,
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
