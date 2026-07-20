"use client";

/**
 * PromptInput shell: owns attachment + text state, form, submit, and provider.
 * Pure UI wrappers (Select / HoverCard / Tabs primitives) live in
 * ./prompt-input-controls and are re-exported below so existing imports work.
 * Pure attachment helpers (filterIncomingFiles, PROMPT_INPUT_ACCEPT, …) live in
 * ./prompt-input-files. Presentational chips live in ./attachments. The bridge
 * strip that wires this state into those chips lives in ./prompt-input-attachments.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PendingAskUserQuestion } from "@/lib/ask-user-question";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { AnimatePresence, motion } from "motion/react";
import type { ChatStatus, FileUIPart, SourceDocumentUIPart } from "ai";
import { DotmTriangle16 } from "@/components/dotmatrix/triangle-16";
import { DotmHex9 } from "@/components/dotmatrix/hex-9";
import { DotMatrixIcon } from "@/components/dotmatrix/icons";
import {
  convertBlobUrlToDataUrl,
  filesToFileUIParts,
  filterIncomingFiles,
  PROMPT_INPUT_ACCEPT,
  revokeFileUrls,
  type AttachmentError,
} from "@/components/chat/ai-elements/prompt-input-files";
import { nanoid } from "nanoid";
import type {
  ChangeEvent,
  ChangeEventHandler,
  ClipboardEventHandler,
  ComponentProps,
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
  KeyboardEventHandler,
  PropsWithChildren,
  ReactNode,
  RefObject,
} from "react";
import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

// Re-export product allowlist so call sites can import from the shell:
// `import { PROMPT_INPUT_ACCEPT } from "@/components/chat/ai-elements/prompt-input"`.
export { PROMPT_INPUT_ACCEPT };

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
// Provider Context & Types
// ============================================================================

/** Attachment store API (context value shape, not a React context). */
export interface AttachmentsValue {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

/** Text field store API (context value shape, not a React context). */
export interface TextInputValue {
  value: string;
  setValue: (v: string) => void;
  clear: () => void;
}

/** Lifted controller state exposed by PromptInputProvider. */
export interface PromptInputControllerValue {
  textInput: TextInputValue;
  attachments: AttachmentsValue;
  /** INTERNAL: Allows PromptInput to register its file input + "open" callback */
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void;
}

const PromptInputControllerContext =
  createContext<PromptInputControllerValue | null>(null);

const ProviderAttachmentsContext = createContext<AttachmentsValue | null>(
  null
);

/** Optional: returns null when outside PromptInputProvider. */
export const useOptionalPromptInputControllerContext = () =>
  useContext(PromptInputControllerContext);

/** Required: throws when outside PromptInputProvider. */
export const usePromptInputControllerContext =
  (): PromptInputControllerValue => {
    const controller = useContext(PromptInputControllerContext);
    if (!controller) {
      throw new Error(
        "usePromptInputControllerContext must be used within a PromptInputProvider"
      );
    }
    return controller;
  };

export const useOptionalProviderAttachments = () =>
  useContext(ProviderAttachmentsContext);

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
  maxFiles?: number;
}>;

/**
 * Optional global provider that lifts PromptInput state outside of PromptInput.
 * If you don't use it, PromptInput stays fully self-managed.
 */
export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  maxFiles,
  children,
}: PromptInputProviderProps) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  // ----- attachments state (global when wrapped)
  const [attachmentFiles, setAttachmentFiles] = useState<
    (FileUIPart & { id: string })[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // oxlint-disable-next-line eslint(no-empty-function)
  const openRef = useRef<() => void>(() => {});

  const add = useCallback(
    (files: File[] | FileList) => {
      const incoming = [...files];
      if (incoming.length === 0) {
        return;
      }

      // Provider path: maxFiles cap only (accept/size validated by PromptInput when present)
      setAttachmentFiles((prev) => {
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - prev.length)
            : undefined;
        const capped =
          typeof capacity === "number"
            ? incoming.slice(0, capacity)
            : incoming;
        return [...prev, ...filesToFileUIParts(capped)];
      });
    },
    [maxFiles]
  );

  const remove = useCallback((id: string) => {
    setAttachmentFiles((prev) => {
      const found = prev.find((f) => f.id === id);
      if (found) {
        revokeFileUrls([found]);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachmentFiles((prev) => {
      revokeFileUrls(prev);
      return [];
    });
  }, []);

  // Keep a ref to attachments for cleanup on unmount (avoids stale closure)
  const attachmentsRef = useRef(attachmentFiles);

  useEffect(() => {
    attachmentsRef.current = attachmentFiles;
  }, [attachmentFiles]);

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(
    () => () => {
      revokeFileUrls(attachmentsRef.current);
    },
    []
  );

  const openFileDialog = useCallback(() => {
    openRef.current?.();
  }, []);

  const attachments = useMemo<AttachmentsValue>(
    () => ({
      add,
      clear,
      fileInputRef,
      files: attachmentFiles,
      openFileDialog,
      remove,
    }),
    [attachmentFiles, add, remove, clear, openFileDialog]
  );

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>, open: () => void) => {
      fileInputRef.current = ref.current;
      openRef.current = open;
    },
    []
  );

  const controller = useMemo<PromptInputControllerValue>(
    () => ({
      __registerFileInput,
      attachments,
      textInput: {
        clear: clearInput,
        setValue: setTextInput,
        value: textInput,
      },
    }),
    [textInput, clearInput, attachments, __registerFileInput]
  );

  return (
    <PromptInputControllerContext.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputControllerContext.Provider>
  );
};

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext<AttachmentsValue | null>(null);

export const usePromptInputAttachments = (): AttachmentsValue => {
  // Prefer local context (inside PromptInput) as it has validation, fall back to provider
  const provider = useOptionalProviderAttachments();
  const local = useContext(LocalAttachmentsContext);
  const value = local ?? provider;
  if (!value) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    );
  }
  return value;
};

// ============================================================================
// Referenced Sources (Local to PromptInput)
// ============================================================================

/** Referenced-sources store API (context value shape, not a React context). */
export interface ReferencedSourcesValue {
  sources: (SourceDocumentUIPart & { id: string })[];
  add: (incoming: SourceDocumentUIPart[] | SourceDocumentUIPart) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const LocalReferencedSourcesContext =
  createContext<ReferencedSourcesValue | null>(null);

export const useOptionalPromptInputReferencedSources = () =>
  useContext(LocalReferencedSourcesContext);

export const usePromptInputReferencedSources = (): ReferencedSourcesValue => {
  const value = useContext(LocalReferencedSourcesContext);
  if (!value) {
    throw new Error(
      "usePromptInputReferencedSources must be used within a PromptInput"
    );
  }
  return value;
};


export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
};

export const PromptInputActionAddAttachments = ({
  label = "Add photos or files",
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const attachments = usePromptInputAttachments();

  const handleSelect = useCallback(
    (e: Event) => {
      e.preventDefault();
      attachments.openFileDialog();
    },
    [attachments]
  );

  return (
    <DropdownMenuItem {...props} onSelect={handleSelect}>
      <DotMatrixIcon name="plus" size={12} className="mr-2" /> {label}
    </DropdownMenuItem>
  );
};

export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

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
  // Try to use a provider controller if present
  const controller = useOptionalPromptInputControllerContext();
  const usingProvider = !!controller;

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // ----- Local attachments (only used when no provider)
  const [localFiles, setLocalFiles] = useState<(FileUIPart & { id: string })[]>(
    []
  );
  const files = usingProvider ? controller.attachments.files : localFiles;

  // ----- Local referenced sources (always local to PromptInput)
  const [referencedSources, setReferencedSources] = useState<
    (SourceDocumentUIPart & { id: string })[]
  >([]);

  // Keep a ref to files for cleanup on unmount (avoids stale closure)
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const addLocal = useCallback(
    (fileList: File[] | FileList) => {
      setLocalFiles((prev) => {
        const capped = filterIncomingFiles(fileList, {
          accept,
          maxFileSize,
          maxFiles,
          currentCount: prev.length,
          onError,
        });
        if (capped.length === 0) {
          return prev;
        }
        return [...prev, ...filesToFileUIParts(capped)];
      });
    },
    [accept, maxFiles, maxFileSize, onError]
  );

  const removeLocal = useCallback(
    (id: string) =>
      setLocalFiles((prev) => {
        const found = prev.find((file) => file.id === id);
        if (found) {
          revokeFileUrls([found]);
        }
        return prev.filter((file) => file.id !== id);
      }),
    []
  );

  // Wrapper that validates files before calling provider's add
  const addWithProviderValidation = useCallback(
    (fileList: File[] | FileList) => {
      const capped = filterIncomingFiles(fileList, {
        accept,
        maxFileSize,
        maxFiles,
        currentCount: files.length,
        onError,
      });
      if (capped.length > 0) {
        controller?.attachments.add(capped);
      }
    },
    [accept, maxFileSize, maxFiles, onError, files.length, controller]
  );

  const clearAttachments = useCallback(
    () =>
      usingProvider
        ? controller?.attachments.clear()
        : setLocalFiles((prev) => {
            revokeFileUrls(prev);
            return [];
          }),
    [usingProvider, controller]
  );

  const clearReferencedSources = useCallback(
    () => setReferencedSources([]),
    []
  );

  const add = usingProvider ? addWithProviderValidation : addLocal;
  const remove = usingProvider ? controller.attachments.remove : removeLocal;
  const openFileDialog = usingProvider
    ? controller.attachments.openFileDialog
    : openFileDialogLocal;

  const clear = useCallback(() => {
    clearAttachments();
    clearReferencedSources();
  }, [clearAttachments, clearReferencedSources]);

  // Let provider know about our hidden file input so external menus can call openFileDialog()
  useEffect(() => {
    if (!usingProvider) {
      return;
    }
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [usingProvider, controller]);

  // Attach drop handlers on form (default) or document (globalDrop opt-in)
  useEffect(() => {
    if (globalDrop) {
      return attachFileDrop(document, add);
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    return attachFileDrop(form, add);
  }, [add, globalDrop]);

  useEffect(
    () => () => {
      if (!usingProvider) {
        revokeFileUrls(filesRef.current);
      }
    },
    [usingProvider]
  );

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (event.currentTarget.files) {
        add(event.currentTarget.files);
      }
      // Reset input value to allow selecting files that were previously removed
      event.currentTarget.value = "";
    },
    [add]
  );

  const attachmentsValue = useMemo<AttachmentsValue>(
    () => ({
      add,
      clear: clearAttachments,
      fileInputRef: inputRef,
      files,
      openFileDialog,
      remove,
    }),
    [files, add, remove, clearAttachments, openFileDialog]
  );

  const referencedSourcesValue = useMemo<ReferencedSourcesValue>(
    () => ({
      add: (incoming: SourceDocumentUIPart[] | SourceDocumentUIPart) => {
        const array = Array.isArray(incoming) ? incoming : [incoming];
        setReferencedSources((prev) => [
          ...prev,
          ...array.map((s) => ({ ...s, id: nanoid() })),
        ]);
      },
      clear: clearReferencedSources,
      remove: (id: string) => {
        setReferencedSources((prev) => prev.filter((s) => s.id !== id));
      },
      sources: referencedSources,
    }),
    [referencedSources, clearReferencedSources]
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const text = usingProvider
        ? controller.textInput.value
        : (() => {
            const formData = new FormData(form);
            return (formData.get("message") as string) || "";
          })();

      // Reset form immediately after capturing text to avoid race condition
      // where user input during async blob conversion would be lost
      if (!usingProvider) {
        form.reset();
      }

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
            clear();
            if (usingProvider) {
              controller.textInput.clear();
            }
          } catch {
            // Don't clear on error - user may want to retry
          }
        } else {
          // Sync function completed without throwing, clear inputs
          clear();
          if (usingProvider) {
            controller.textInput.clear();
          }
        }
      } catch {
        // Don't clear on error - user may want to retry
      }
    },
    [usingProvider, controller, files, onSubmit, clear]
  );

  // Strip motion-incompatible DOM drag/animation handlers from rest spread
  const restProps = { ...props };
  for (const key of MOTION_DOM_PROP_KEYS) {
    delete restProps[key];
  }

  const inner = (
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

  const withReferencedSources = (
    <LocalReferencedSourcesContext.Provider value={referencedSourcesValue}>
      {inner}
    </LocalReferencedSourcesContext.Provider>
  );

  // Always provide LocalAttachmentsContext so children get validated add function
  return (
    <LocalAttachmentsContext.Provider value={attachmentsValue}>
      {withReferencedSources}
    </LocalAttachmentsContext.Provider>
  );
};

export type PromptInputWidgetOption = PendingAskUserQuestion["options"][number];
export type PromptInputWidgetResponse = [
  {
    question: PendingAskUserQuestion["question"];
    response: PendingAskUserQuestion["options"][number];
  }
];

export type PromptInputQuestionProps = {
  id: string;
  children: string;
};

/**
 * Widget-mode question header — leaf only; no card/border/bg.
 * Body owns H gutter (`--prompt-body-px/py`); leaves have no horizontal pad.
 */
export function PromptInputQuestion({
  id,
  children,
}: PromptInputQuestionProps) {
  return (
    <p
      id={id}
      data-slot="prompt-input-question"
      className="w-full min-w-0 text-left text-base font-semibold leading-snug text-text-primary line-clamp-2"
    >
      {children}
    </p>
  );
}

export type PromptInputOptionProps = {
  option: PromptInputWidgetOption;
  onSelect?: (option: PromptInputWidgetOption) => void;
};

/**
 * Widget-mode option chip — leaf only; listbox shell stays on Body.
 * Body owns H gutter; leaves have no horizontal pad.
 */
export function PromptInputOption({
  option,
  onSelect,
}: PromptInputOptionProps) {
  return (
    <button
      type="button"
      role="option"
      data-slot="prompt-input-option"
      className={cn(
        "w-full min-h-8 rounded-[var(--radius)] py-2 text-left text-sm text-text-primary",
        "transition-colors outline-none",
        "hover:bg-[var(--surface-hover)]",
        "focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={() => {
        onSelect?.(option);
      }}
    >
      {option.label}
    </button>
  );
}

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement> & {
  pendingAsk?: PendingAskUserQuestion | null;
  onOptionSelect?: (option: PromptInputWidgetOption) => void;
};

export const PromptInputBody = ({
  className,
  children,
  pendingAsk = null,
  onOptionSelect,
  ...props
}: PromptInputBodyProps) => {
  const questionId = useId();
  const isWidgetMode = pendingAsk != null;
  const questionText = pendingAsk?.question.trim() ?? "";
  const options = pendingAsk?.options ?? [];
  const showQuestion = isWidgetMode && questionText.length > 0;
  const showOptions = isWidgetMode && options.length > 0;

  return (
    /* Body owns H gutter (tokens --prompt-body-px/py); leaves have no horizontal pad. */
    <div
      className={cn(
        "flex w-full min-w-0 px-prompt-body-x py-prompt-body-y",
        className,
      )}
      {...props}
    >
      {/* Thin shell: layout only (`flex-col gap-2` when widget) — no pad.
          Widget column aligns at Body content edge. */}
      <div
        className={cn(
          "w-full min-w-0",
          isWidgetMode && "flex flex-col gap-2",
        )}
      >
        {showQuestion ? (
          <PromptInputQuestion id={questionId}>
            {questionText}
          </PromptInputQuestion>
        ) : null}
        {showOptions ? (
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              isWidgetMode ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
            data-slot="prompt-input-options"
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className="flex flex-col gap-1"
                role="listbox"
                {...(showQuestion
                  ? { "aria-labelledby": questionId }
                  : { "aria-label": "Options" })}
              >
                {options.map((option) => (
                  <PromptInputOption
                    key={option.id}
                    option={option}
                    onSelect={onOptionSelect}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {/* Textarea tree always last, always mounted */}
        {children}
      </div>
    </div>
  );
};

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
>;

export const PromptInputTextarea = ({
  onChange,
  onKeyDown,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const controller = useOptionalPromptInputControllerContext();
  const attachments = usePromptInputAttachments();
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) {
        return;
      }

      if (e.key === "Enter") {
        if (isComposing || e.nativeEvent.isComposing) {
          return;
        }
        if (e.shiftKey) {
          return;
        }
        e.preventDefault();

        const { form } = e.currentTarget;
        const submitButton = form?.querySelector(
          'button[type="submit"]'
        ) as HTMLButtonElement | null;
        if (submitButton?.disabled) {
          return;
        }

        form?.requestSubmit();
      }

      if (
        e.key === "Backspace" &&
        e.currentTarget.value === "" &&
        attachments.files.length > 0
      ) {
        e.preventDefault();
        const lastAttachment = attachments.files.at(-1);
        if (lastAttachment) {
          attachments.remove(lastAttachment.id);
        }
      }
    },
    [onKeyDown, isComposing, attachments]
  );

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      const items = event.clipboardData?.items;

      if (!items) {
        return;
      }

      const files: File[] = [];

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        event.preventDefault();
        attachments.add(files);
      }
    },
    [attachments]
  );

  const handleCompositionEnd = useCallback(() => setIsComposing(false), []);
  const handleCompositionStart = useCallback(() => setIsComposing(true), []);

  const [uncontrolledVal, setUncontrolledVal] = useState(
    () => String(props.defaultValue ?? props.value ?? ""),
  );
  const textValue = controller
    ? controller.textInput.value
    : props.value !== undefined
      ? String(props.value)
      : uncontrolledVal;

  const handleTextareaChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.currentTarget.value;
      if (controller) {
        controller.textInput.setValue(next);
      } else if (props.value === undefined) {
        setUncontrolledVal(next);
      }
      onChange?.(e);
    },
    [controller, onChange, props.value],
  );

  const controlledProps = controller
    ? { value: controller.textInput.value }
    : props.value !== undefined
      ? { value: String(props.value) }
      : { value: uncontrolledVal };

  const isEmpty = !textValue;
  const { style: propsStyle, ...restTextareaProps } = props;

  return (
    <div className="relative flex w-full min-w-0 flex-grow">
      <InputGroupTextarea
        className={cn(
          // Body owns H gutter; leaves have no horizontal pad.
          // min-h / py-0 beat ui/textarea min-h-16 + InputGroupTextarea py-2.
          "field-sizing-content max-h-48 w-full resize-none overflow-x-hidden !px-0 !py-0",
          "min-h-[var(--prompt-textarea-min-h)] !min-h-[var(--prompt-textarea-min-h)]",
          "text-sm leading-5 text-text-primary placeholder:text-text-secondary",
          className
        )}
        style={propsStyle}
        name="message"
        aria-label="Message input"
        onCompositionEnd={handleCompositionEnd}
        onCompositionStart={handleCompositionStart}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={isEmpty ? placeholder : ""}
        {...restTextareaProps}
        {...controlledProps}
        onChange={handleTextareaChange}
      />
    </div>
  );
};

export type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputHeader = ({
  className,
  children,
  ...props
}: PromptInputHeaderProps) => {
  if (Children.count(children) === 0) {
    return null;
  }

  return (
    <InputGroupAddon
      align="block-start"
      className={cn("flex-col gap-0 items-start w-full px-0 pt-0 pb-0", className)}
      {...props}
    >
      {children}
    </InputGroupAddon>
  );
};

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputFooter = ({
  className,
  children,
  ...props
}: PromptInputFooterProps) => {
  return (
    <InputGroupAddon
      data-prompt-footer
      align="block-end"
      className={cn("justify-between gap-1", className)}
      {...props}
    >
      {children}
    </InputGroupAddon>
  );
};

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  children,
  ...props
}: PromptInputToolsProps) => {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export type PromptInputButtonTooltip =
  | string
  | {
      content: ReactNode;
      shortcut?: string;
      side?: ComponentProps<typeof TooltipContent>["side"];
    };

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton> & {
  tooltip?: PromptInputButtonTooltip;
};

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  tooltip,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

  const button = (
    <InputGroupButton
      className={cn(className)}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  const tooltipContent =
    typeof tooltip === "string" ? tooltip : tooltip.content;
  const shortcut = typeof tooltip === "string" ? undefined : tooltip.shortcut;
  const side = typeof tooltip === "string" ? "top" : (tooltip.side ?? "top");

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={side}>
        {tooltipContent}
        {shortcut && (
          <span className="ml-2 text-muted-foreground">{shortcut}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
  <DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger asChild>
    <PromptInputButton className={className} {...props}>
      {children ?? (
        <DotMatrixIcon name="plus" size={ICON_GLYPH.toolbar} />
      )}
    </PromptInputButton>
  </DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;
export const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps) => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps) => (
  <DropdownMenuItem className={cn(className)} {...props} />
);

// Side-effect actions (e.g. opening a file dialog): PromptInputActionAddAttachments above.

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const isGenerating = status === "submitted" || status === "streaming";

  const iconKey = status || "ready";
  let Icon = (
    <DotmTriangle16
      size={ICON_GLYPH.toolbar}
      dotSize={2}
      dotShape="square"
      color="currentColor"
      animated={status === "submitted"}
    />
  );

  if (status === "streaming") {
    Icon = (
      <DotmHex9
        size={ICON_GLYPH.toolbar}
        dotSize={2.5}
        dotShape="square"
        color="currentColor"
        animated={true}
      />
    );
  }

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isGenerating && onStop) {
        e.preventDefault();
        onStop();
        return;
      }
      onClick?.(e);
    },
    [isGenerating, onStop, onClick]
  );

  return (
    <InputGroupButton
      aria-label={isGenerating ? "Stop" : "Submit"}
      className={cn(className)}
      onClick={handleClick}
      size={size}
      type={isGenerating && onStop ? "button" : "submit"}
      variant={variant}
      {...props}
    >
      {children ?? (
        <AnimatePresence mode="wait">
          <motion.div
            key={iconKey}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            {Icon}
          </motion.div>
        </AnimatePresence>
      )}
    </InputGroupButton>
  );
};

// Re-export pure UI wrappers (Select / HoverCard / Tabs primitives) from
// ./prompt-input-controls so existing imports keep working.
export {
  PromptInputHoverCard,
  PromptInputHoverCardContent,
  PromptInputHoverCardTrigger,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputTab,
  PromptInputTabsList,
} from "./prompt-input-controls";
export type {
  PromptInputHoverCardContentProps,
  PromptInputHoverCardProps,
  PromptInputHoverCardTriggerProps,
  PromptInputSelectContentProps,
  PromptInputSelectItemProps,
  PromptInputSelectProps,
  PromptInputSelectTriggerProps,
  PromptInputSelectValueProps,
  PromptInputTabProps,
  PromptInputTabsListProps,
} from "./prompt-input-controls";
