"use client";

/**
 * Prompt shell: PromptInput form primitive + PromptInputWorkspace product export.
 * PromptInput requires outer PromptInputProvider. Draft state lives in ./context.
 * PromptInputWorkspace mounts the provider internally for /home.
 */

import { InputGroup } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PromptInputMessage } from "@/types/chat";
import type { FileUIPart } from "ai";
import {
  convertBlobUrlToDataUrl,
  filterIncomingFiles,
  PROMPT_INPUT_ACCEPT,
  type AttachmentError,
} from "../attachments/prompt-input-files";
import type {
  ChangeEventHandler,
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PromptInputProvider,
  usePromptInputContext,
} from "./context";
import { PromptInputHeader } from "../header/header";
import { PromptInputBody } from "../body/body";
import { PromptInputTextarea } from "../body/textarea";
import { PromptInputFooter } from "../footer/footer";
import { PromptInputTools } from "../footer/tools";
import { PromptInputButton } from "../footer/button";
import { PromptInputSubmit } from "../footer/submit";
import { SpeechInput } from "../footer/speech-input";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "../footer/model-selector";
import { PromptInputAttachments } from "../attachments/attachment-strip";
import { DotMatrixIcon } from "@/components/dotmatrix";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { toast } from "@/components/ui/app-toaster";
import {
  formatAskUserQuestionAnswer,
  getPendingAskUserQuestion,
} from "@/lib/ask-user-question";
import { chefs, models } from "@/lib/models";
import { useChatContext } from "@/contexts/ChatContext";

// PROMPT_INPUT_ACCEPT lives in attachments/prompt-input-files; re-exported via
// the `@/components/chat/prompt` barrel.

// ============================================================================
// Helpers
// ============================================================================

/** Attach dragover/drop listeners that forward FileList to onFiles. */
function attachFileDrop(
  target: Document | HTMLElement,
  onFiles: (files: FileList) => void
): () => void {
  const onDragOver = (e: Event) => {
    const de = e as DragEvent;
    if (de.dataTransfer?.types?.includes("Files")) {
      de.preventDefault();
    }
  };
  const onDrop = (e: Event) => {
    const de = e as DragEvent;
    if (de.dataTransfer?.types?.includes("Files")) {
      de.preventDefault();
    }
    if (de.dataTransfer?.files && de.dataTransfer.files.length > 0) {
      onFiles(de.dataTransfer.files);
    }
  };
  target.addEventListener("dragover", onDragOver);
  target.addEventListener("drop", onDrop);
  return () => {
    target.removeEventListener("dragover", onDragOver);
    target.removeEventListener("drop", onDrop);
  };
}

const MOTION_DOM_PROP_KEYS = [
  "onDrag",
  "onDragStart",
  "onDragEnd",
  "onAnimationStart",
  "onAnimationEnd",
  "onAnimationIteration",
] as const;

// ============================================================================
// PromptInput form
// ============================================================================

export type { PromptInputMessage };

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "onError"
> & {
  // e.g., "image/*" or leave undefined for any
  accept?: string;
  multiple?: boolean;
  // When true, accepts drops anywhere on document. Default false (opt-in).
  globalDrop?: boolean;
  // Minimal constraints
  maxFiles?: number;
  // bytes
  maxFileSize?: number;
  onError?: (err: AttachmentError) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void | Promise<void>;
};

export const PromptInput = ({
  className,
  accept,
  multiple,
  globalDrop,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const promptInput = usePromptInputContext();
  const { attachments, textInput } = promptInput;

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Latest validation props for the registered gate (stable registration effect)
  const validationRef = useRef({ accept, maxFileSize, maxFiles, onError });
  validationRef.current = { accept, maxFileSize, maxFiles, onError };

  // Register file input so external openFileDialog() works
  useEffect(() => {
    promptInput.__registerFileInput(inputRef);
  }, [promptInput]);

  // Register accept/size/maxFiles gate so attachments.add is always validated
  // while PromptInput is mounted (children, drop, file picker share one path).
  useEffect(() => {
    promptInput.__registerAttachmentValidator((files, currentCount) => {
      const v = validationRef.current;
      return filterIncomingFiles(files, {
        accept: v.accept,
        maxFileSize: v.maxFileSize,
        maxFiles: v.maxFiles,
        currentCount,
        onError: v.onError,
      });
    });
    return () => {
      promptInput.__registerAttachmentValidator(null);
    };
  }, [promptInput]);

  // Attach drop handlers on form (default) or document (globalDrop opt-in)
  useEffect(() => {
    if (globalDrop) {
      return attachFileDrop(document, attachments.add);
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    return attachFileDrop(form, attachments.add);
  }, [attachments.add, globalDrop]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (event.currentTarget.files) {
        attachments.add(event.currentTarget.files);
      }
      // Reset input value to allow selecting files that were previously removed
      event.currentTarget.value = "";
    },
    [attachments]
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();

      const text = textInput.value;
      const files = attachments.files;

      try {
        // Convert blob URLs to data URLs asynchronously
        const convertedFiles: FileUIPart[] = await Promise.all(
          files.map(async ({ id: _id, ...item }) => {
            if (item.url?.startsWith("blob:")) {
              const dataUrl = await convertBlobUrlToDataUrl(item.url);
              // If conversion failed, keep the original blob URL
              return {
                ...item,
                url: dataUrl ?? item.url,
              };
            }
            return item;
          })
        );

        const result = onSubmit({ files: convertedFiles, text }, event);

        // Handle both sync and async onSubmit
        if (result instanceof Promise) {
          try {
            await result;
            attachments.clear();
            textInput.clear();
          } catch {
            // Don't clear on error - user may want to retry
          }
        } else {
          // Sync function completed without throwing, clear inputs
          attachments.clear();
          textInput.clear();
        }
      } catch {
        // Don't clear on error - user may want to retry
      }
    },
    [attachments, textInput, onSubmit]
  );

  // Strip motion-incompatible DOM drag/animation handlers from rest spread
  const restProps = { ...props };
  for (const key of MOTION_DOM_PROP_KEYS) {
    delete restProps[key];
  }

  return (
    <>
      <input
        accept={accept}
        aria-label="Upload files"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title="Upload files"
        type="file"
      />
      <form
        className={cn("w-full", className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...restProps}
      >
        <InputGroup className="h-auto flex-col overflow-hidden">
          {children}
        </InputGroup>
      </form>
    </>
  );
};

// ============================================================================
// PromptInputWorkspace — product export for /home
// ============================================================================

const ModelItem = ({
  m,
  isSelected,
  onSelect,
}: {
  m: (typeof models)[0];
  isSelected: boolean;
  onSelect: (id: string) => void;
}) => {
  const handleSelect = useCallback(() => {
    onSelect(m.id);
  }, [onSelect, m.id]);

  return (
    <ModelSelectorItem onSelect={handleSelect} value={m.name}>
      <ModelSelectorLogo icon={m.icon} />
      <ModelSelectorName>{m.name}</ModelSelectorName>
      {isSelected ? (
        <DotMatrixIcon name="check" size={ICON_GLYPH.badge} className="ml-auto" />
      ) : (
        <div className="ml-auto size-2.5" />
      )}
    </ModelSelectorItem>
  );
};

/** Product prompt block for /home — provider + form + footer in one shell export. */
export function PromptInputWorkspace() {
  return (
    <PromptInputProvider>
      <PromptInputWorkspaceContent />
    </PromptInputProvider>
  );
}

/** Reads stream state from ChatProvider; owns pending-ask derivation for the shell. */
function PromptInputWorkspaceContent() {
  const { sendMessage, status, stop, messages } = useChatContext();
  const pendingAsk = useMemo(
    () => getPendingAskUserQuestion(messages),
    [messages],
  );
  const {
    attachments,
    textInput,
    prefs: { model, setModel, mode, setMode, useWebSearch, toggleWebSearch },
  } = usePromptInputContext();

  const submitUserMessage = useCallback(
    async (
      message: PromptInputMessage,
      prefs: {
        model: string;
        mode: string;
        useWebSearch: boolean;
      },
    ) => {
      if (status !== "ready") return;

      const hasText = Boolean(message.text?.trim());
      const hasAttachments = Boolean(message.files?.length);

      if (!hasText && !hasAttachments) {
        return;
      }

      const submitModel = prefs.model;
      const submitMode = prefs.mode;
      const submitUseWebSearch = prefs.useWebSearch;

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
            body: {
              model: submitModel,
              useWebSearch: submitUseWebSearch,
              mode: submitMode,
            },
          },
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to send message");
      }
    },
    [sendMessage, status],
  );

  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === model),
    [model],
  );

  /**
   * Single send path for form submit and MCQ option clicks.
   * Option select: handleSubmit({ text: option.label, files: [] }).
   * Pending ask → formatAskUserQuestionAnswer once; else normal chat.
   */
  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (status !== "ready") return;

      const answer = message.text?.trim() ?? "";
      const hasFiles = (message.files?.length ?? 0) > 0;
      const prefs = { model, mode, useWebSearch };

      if (pendingAsk != null) {
        // Empty form / nothing to answer.
        if (!answer && !hasFiles) return;
        // Pure MCQ: require a choice label (option path); files alone are not an answer.
        if (!pendingAsk.allowCustomInput && !answer) return;

        void submitUserMessage(
          {
            text: formatAskUserQuestionAnswer({
              question: pendingAsk.question,
              answer: answer.length > 0 ? answer : "(attachment)",
            }),
            files: message.files,
          },
          prefs,
        );
        return;
      }
      void submitUserMessage(message, prefs);
    },
    [submitUserMessage, pendingAsk, status, model, mode, useWebSearch],
  );

  const handleTranscriptionChange = useCallback(
    (transcript: string) => {
      textInput.setValue(
        textInput.value
          ? `${textInput.value} ${transcript}`
          : transcript,
      );
    },
    [textInput],
  );

  const handleAttachmentError = useCallback((err: { message: string }) => {
    toast.error(err.message);
  }, []);

  const handleSpeechError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const handleModelSelect = useCallback(
    (modelId: string) => {
      setModel(modelId);
      setModelSelectorOpen(false);
    },
    [setModel],
  );

  const isSubmitDisabled = useMemo(
    () =>
      status === "ready" &&
      ((pendingAsk != null && !pendingAsk.allowCustomInput) ||
        (!textInput.value.trim() &&
          attachments.files.length === 0)),
    [
      textInput.value,
      attachments.files.length,
      status,
      pendingAsk,
    ],
  );

  return (
    <div className="w-full px-4 pb-4 pt-1">
      <div className="chat-input-wrap relative">
        <div className="chat-input-glow" />
        <PromptInput
          globalDrop
          multiple
          onSubmit={handleSubmit}
          accept={PROMPT_INPUT_ACCEPT}
          maxFiles={5}
          maxFileSize={10 * 1024 * 1024}
          onError={handleAttachmentError}
        >
          <PromptInputHeader>
            <PromptInputAttachments />
          </PromptInputHeader>
          <PromptInputBody
            pendingAsk={pendingAsk}
            onOptionSelect={(option) =>
              handleSubmit({ text: option.label, files: [] })
            }
          >
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton
                onClick={attachments.openFileDialog}
                size="icon-sm"
                variant="ghost"
                aria-label="Add photos or files"
                tooltip={{
                  content: "Add photos or files",
                  side: "top",
                }}
                className="text-text-primary hover:bg-[var(--surface-hover)]"
              >
                <DotMatrixIcon name="plus" size={ICON_GLYPH.toolbar} />
              </PromptInputButton>
              <SpeechInput
                className="shrink-0 text-text-primary hover:bg-[var(--surface-hover)]"
                onTranscriptionChange={handleTranscriptionChange}
                onError={handleSpeechError}
                size="icon-sm"
                variant="ghost"
              />
              <PromptInputButton
                onClick={toggleWebSearch}
                size="icon-sm"
                variant={useWebSearch ? "default" : "ghost"}
                aria-label={
                  useWebSearch ? "Disable web search" : "Enable web search"
                }
                tooltip={{
                  content: useWebSearch
                    ? "Disable web search"
                    : "Enable web search",
                  side: "top",
                }}
                className={cn(
                  "transition-colors",
                  useWebSearch
                    ? "bg-primary text-accent-ink hover:bg-accent-hover"
                    : "text-text-primary hover:bg-[var(--surface-hover)]",
                )}
              >
                <DotMatrixIcon name="globe" size={ICON_GLYPH.toolbar} />
              </PromptInputButton>
              <ModelSelector
                onOpenChange={setModelSelectorOpen}
                open={modelSelectorOpen}
              >
                <ModelSelectorTrigger asChild>
                  <PromptInputButton
                    data-model-trigger
                    className="shrink-0 text-text-primary hover:bg-[var(--surface-hover)] flex items-center gap-1.5"
                    variant="ghost"
                    aria-label={`Select model, currently ${selectedModelData?.name ?? "none"}`}
                  >
                    {selectedModelData ? (
                      <selectedModelData.icon className="size-3 shrink-0" />
                    ) : (
                      <DotMatrixIcon name="settings" size={ICON_GLYPH.toolbar} />
                    )}
                    {selectedModelData ? (
                      <span className="text-[11px] font-[family-name:var(--font-body)] font-medium tracking-wide">
                        {selectedModelData.name}
                      </span>
                    ) : null}
                  </PromptInputButton>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  <ModelSelectorInput placeholder="Search models..." />
                  <ModelSelectorList>
                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    {chefs.map((chef) => (
                      <ModelSelectorGroup heading={chef} key={chef}>
                        {models
                          .filter((m) => m.chef === chef)
                          .map((m) => (
                            <ModelItem
                              isSelected={model === m.id}
                              key={m.id}
                              m={m}
                              onSelect={handleModelSelect}
                            />
                          ))}
                      </ModelSelectorGroup>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
              {selectedModelData?.mode &&
                selectedModelData.mode.length > 0 && (
                  <ModelSelector
                    onOpenChange={setModeSelectorOpen}
                    open={modeSelectorOpen}
                  >
                    <ModelSelectorTrigger asChild>
                      <PromptInputButton
                        data-model-trigger
                        className="shrink-0 text-text-primary hover:bg-[var(--surface-hover)] flex items-center justify-center px-2"
                        variant="ghost"
                        aria-label="Select mode"
                      >
                        <span className="text-[11px] font-[family-name:var(--font-body)] font-medium tracking-wide capitalize">
                          {mode}
                        </span>
                      </PromptInputButton>
                    </ModelSelectorTrigger>
                    <ModelSelectorContent className="w-auto">
                      <ModelSelectorList>
                        {selectedModelData.mode.map((m) => (
                          <ModelSelectorItem
                            key={m}
                            value={m}
                            onSelect={(val) => {
                              setMode(val);
                              setModeSelectorOpen(false);
                            }}
                          >
                            <span className="capitalize">{m}</span>
                            {mode === m && (
                              <DotMatrixIcon
                                name="check"
                                size={ICON_GLYPH.badge}
                                className="ml-auto opacity-50"
                              />
                            )}
                          </ModelSelectorItem>
                        ))}
                      </ModelSelectorList>
                    </ModelSelectorContent>
                  </ModelSelector>
                )}
            </PromptInputTools>
            <PromptInputSubmit
              className={cn(
                "!size-8 !rounded-[var(--radius)] transition-colors duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] disabled:!opacity-100",
                !isSubmitDisabled
                  ? "bg-primary text-accent-ink hover:bg-accent-hover"
                  : "text-text-primary hover:bg-[var(--surface-hover)]",
              )}
              variant={!isSubmitDisabled ? "default" : "ghost"}
              disabled={isSubmitDisabled}
              onStop={stop}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
