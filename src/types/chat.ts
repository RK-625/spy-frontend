import {
  ChatRequestOptions,
  ChatStatus,
  CreateUIMessage,
  TextUIPart,
  UIMessage,
} from "ai";
import React from "react";

export type { ChatStatus };

export interface ChatContextValue {
  // State
  model: string;
  setModel: (id: string) => void;
  modelSelectorOpen: boolean;
  setModelSelectorOpen: (b: boolean) => void;
  textPart: TextUIPart;
  setTextPart: React.Dispatch<React.SetStateAction<TextUIPart>>;
  useWebSearch: boolean;
  setUseWebSearch: (b: boolean) => void;
  status: ChatStatus;
  messages: UIMessage[];

  // Actions
  toggleWebSearch: () => void;
  clearMessages: () => void;
  error: Error | undefined;
  handleSubmit: (e?: { preventDefault?: () => void }) => void;
  stop: () => void;
  sendMessage: (
    message?: CreateUIMessage<UIMessage>,
    options?: ChatRequestOptions,
  ) => Promise<void>;
}
