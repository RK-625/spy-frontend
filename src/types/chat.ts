import {
  ChatRequestOptions,
  ChatStatus,
  CreateUIMessage,
  FileUIPart,
  UIMessage,
} from "ai";

export type { ChatStatus };

export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

export interface ChatContextValue {
  // State
  model: string;
  setModel: (id: string) => void;
  mode: string;
  setMode: (mode: string) => void;
  modelSelectorOpen: boolean;
  setModelSelectorOpen: (open: boolean) => void;
  modeSelectorOpen: boolean;
  setModeSelectorOpen: (open: boolean) => void;
  useWebSearch: boolean;
  setUseWebSearch: (enabled: boolean) => void;
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
