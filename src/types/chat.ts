import { ChatRequestOptions, ChatStatus, ToolUIPart, UIMessage } from "ai";
import React from "react";

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

export type { ChatStatus };

export interface ChatContextValue {
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
  messages: ChatMessage[];

  // Actions
  clearMessages: () => void;
  toggleWebSearch: () => void;
  error: string | null;
  handleSubmit: (e?: { preventDefault?: () => void }) => void;
  stop: () => void;
  append: (
    message: UIMessage | Omit<UIMessage, "id">,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}