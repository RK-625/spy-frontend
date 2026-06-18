"use client";

import type { ToolUIPart } from "ai";
import { createContext, useCallback, useContext, useState } from "react";

export interface ChatMessage {
  key: string;
  from: "user" | "assistant";
  sources?: { href: string; title: string }[];
  versions: {
    id: string;
    content: string;
  }[];
  reasoning?: {
    content: string;
    duration: number;
  };
  tools?: {
    name: string;
    description: string;
    status: ToolUIPart["state"];
    parameters: Record<string, unknown>;
    result: string | undefined;
    error: string | undefined;
  }[];
}

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

interface ChatContextValue {
  // State
  model: string;
  setModel: (id: string) => void;
  modelSelectorOpen: boolean;
  setModelSelectorOpen: (b: boolean) => void;
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  useWebSearch: boolean;
  setUseWebSearch: (b: boolean) => void;
  status: ChatStatus;
  setStatus: (s: ChatStatus) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  streamingMessageId: string | null;
  setStreamingMessageId: (id: string | null) => void;

  // Actions
  clearMessages: () => void;
  updateMessageContent: (messageId: string, newContent: string) => void;
  toggleWebSearch: () => void;
  setError: (error: string | null) => void;
  error: string | null;
}

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
  const [text, setText] = useState<string>("");
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setText("");
    setStatus("ready");
    setError(null);
    setStreamingMessageId(null);
  }, []);

  const updateMessageContent = useCallback(
    (messageId: string, newContent: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.versions.some((v) => v.id === messageId)) {
            return {
              ...msg,
              versions: msg.versions.map((v) =>
                v.id === messageId ? { ...v, content: newContent } : v
              ),
            };
          }
          return msg;
        })
      );
    },
    []
  );

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
    setStatus,
    messages,
    setMessages,
    streamingMessageId,
    setStreamingMessageId,
    clearMessages,
    updateMessageContent,
    toggleWebSearch,
    error,
    setError,
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
