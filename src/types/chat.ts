import {
  ChatRequestOptions,
  ChatStatus,
  CreateUIMessage,
  TextUIPart,
  UIMessage,
} from "ai";
import React from "react";
import type { PromptInputMessage } from "@/components/chat/ai-elements/prompt-input";

export type { ChatStatus };

export interface ChatContextValue {
  // State
  model: string;
  setModel: (id: string) => void;
  mode: string;
  setMode: (mode: string) => void;
  modelSelectorOpen: boolean;
  setModelSelectorOpen: (b: boolean) => void;
  modeSelectorOpen: boolean;
  setModeSelectorOpen: (b: boolean) => void;
  useWebSearch: boolean;
  setUseWebSearch: (b: boolean) => void;
  status: ChatStatus;
  messages: UIMessage[];

  // Actions
  toggleWebSearch: () => void;
  clearMessages: () => void;
  error: Error | undefined;
  handleSubmit: (message: PromptInputMessage) => void;
  stop: () => void;
  sendMessage: (
    message?: CreateUIMessage<UIMessage>,
    options?: ChatRequestOptions,
  ) => Promise<void>;
  addToolOutput: ReturnType<typeof import("@ai-sdk/react").useChat>["addToolOutput"];
}
