"use client";

/**
 * Bridges stream (ChatContext) + prompt prefs (PromptShellProvider) for send.
 * Must NOT call useChat() — single useChat remains in ChatProvider.
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { useChatContext } from "@/contexts/ChatContext";
import { usePromptShellControllerContext } from "@/components/chat";
import type { PromptInputMessage } from "@/types/chat";

export type ChatSubmitPrefsOverride = Partial<{
  model: string;
  mode: string;
  useWebSearch: boolean;
}>;

export type UseChatSubmitResult = {
  /** Send a user message with controller prefs (or overrides). Same guards as legacy handleSubmit. */
  submitUserMessage: (
    message: PromptInputMessage,
    overrides?: ChatSubmitPrefsOverride,
  ) => Promise<void>;
  status: ReturnType<typeof useChatContext>["status"];
  stop: ReturnType<typeof useChatContext>["stop"];
};

/**
 * Submit path for /home and any prompt surface under both providers.
 * Guards: status === "ready", non-empty text or files; toast on send failure.
 */
export function useChatSubmit(): UseChatSubmitResult {
  const { sendMessage, status, stop } = useChatContext();
  const { prefs } = usePromptShellControllerContext();

  const submitUserMessage = useCallback(
    async (
      message: PromptInputMessage,
      overrides?: ChatSubmitPrefsOverride,
    ) => {
      if (status !== "ready") return;

      const hasText = Boolean(message.text?.trim());
      const hasAttachments = Boolean(message.files?.length);

      if (!hasText && !hasAttachments) {
        return;
      }

      const model = overrides?.model ?? prefs.model;
      const mode = overrides?.mode ?? prefs.mode;
      const useWebSearch = overrides?.useWebSearch ?? prefs.useWebSearch;

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
      } catch (error) {
        console.error(error);
        toast.error("Failed to send message");
      }
    },
    [sendMessage, status, prefs.model, prefs.mode, prefs.useWebSearch],
  );

  return { submitUserMessage, status, stop };
}
