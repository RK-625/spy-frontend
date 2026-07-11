"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { WIDGET, WIDGET_TYPE } from "@/lib/widget-layout";
import type { ChatStatus, FileUIPart, SourceDocumentUIPart } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { DotmTriangle16 } from "@/components/ui/dotm-triangle-16";
import { DotmHex9 } from "@/components/ui/dotm-hex-9";
import { DotMatrixIcon } from "@/components/chat/ai-elements/dot-matrix-icons";
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
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

const MotionInputGroup = motion.create(InputGroup);

// ============================================================================
// Helpers
// ============================================================================

const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    // FileReader uses callback-based API, wrapping in Promise is necessary
    // oxlint-disable-next-line eslint-plugin-promise(avoid-new)
    return new Promise((resolve) => {
      const reader = new FileReader();
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      reader.onloadend = () => resolve(reader.result as string);
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const captureScreenshot = async (): Promise<File | null> => {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    return null;
  }

  let stream: MediaStream | null = null;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: true,
    });

    video.srcObject = stream;

    // Video element uses callback-based API, wrapping in Promise is necessary
    // oxlint-disable-next-line eslint-plugin-promise(avoid-new)
    await new Promise<void>((resolve, reject) => {
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      video.onloadedmetadata = () => resolve();
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      video.onerror = () => reject(new Error("Failed to load screen stream"));
    });

    await video.play();

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, width, height);
    // canvas.toBlob uses callback-based API, wrapping in Promise is necessary
    // oxlint-disable-next-line eslint-plugin-promise(avoid-new)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) {
      return null;
    }

    const timestamp = new Date()
      .toISOString()
      .replaceAll(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "");

    return new File([blob], `screenshot-${timestamp}.png`, {
      lastModified: Date.now(),
      type: "image/png",
    });
  } finally {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    video.pause();
    video.srcObject = null;
  }
};

// ============================================================================
// Provider Context & Types
// ============================================================================

export interface AttachmentsContext {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export interface TextInputContext {
  value: string;
  setInput: (v: string) => void;
  clear: () => void;
}

export type AskUserQuestionData = {
  question: string;
  options: string[];
  allowCustomInput: boolean;
} | null;

export interface PromptInputControllerProps {
  textInput: TextInputContext;
  attachments: AttachmentsContext;
  /** INTERNAL: Allows PromptInput to register its file textInput + "open" callback */
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void;
  askUserQuestionData?: AskUserQuestionData;
  setAskUserQuestionData?: (data: AskUserQuestionData) => void;
  handleOptionSelect?: (option: string) => void;
  /** Shared cascade-exit flag: true while options/pencil are animating out after widget close. */
  isCascadeExiting: boolean;
}

const PromptInputController = createContext<PromptInputControllerProps | null>(
  null
);
const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(
  null
);


// Optional variants (do NOT throw). Useful for dual-mode components.
export const useOptionalPromptInputController = () =>
  useContext(PromptInputController);


export const useOptionalProviderAttachments = () =>
  useContext(ProviderAttachmentsContext);

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
  maxFiles?: number;
  askUserQuestionData?: AskUserQuestionData;
  setAskUserQuestionData?: (data: AskUserQuestionData) => void;
}>;

/**
 * Optional global provider that lifts PromptInput state outside of PromptInput.
 * If you don't use it, PromptInput stays fully self-managed.
 */
export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  maxFiles,
  askUserQuestionData,
  setAskUserQuestionData,
  children,
}: PromptInputProviderProps) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  // ----- shared cascade-exit state (single source for Body + Textarea)
  const [isCascadeExiting, setIsCascadeExiting] = useState(false);
  const [prevAskData, setPrevAskData] = useState(askUserQuestionData);
  // Last non-null payload for exit duration (prevAskData is already null when exit starts)
  const lastAskMetaRef = useRef({ n: 0, allowCustom: false });
  if (askUserQuestionData) {
    lastAskMetaRef.current = {
      n: askUserQuestionData.options.length,
      allowCustom: !!askUserQuestionData.allowCustomInput,
    };
  }

  if (askUserQuestionData !== prevAskData) {
    setPrevAskData(askUserQuestionData);
    if (!askUserQuestionData) {
      setIsCascadeExiting(true);
    } else {
      setIsCascadeExiting(false);
    }
  }

  useEffect(() => {
    if (!isCascadeExiting) return;
    const { n, allowCustom } = lastAskMetaRef.current;
    // Hold through last content exit AND layout spring settle (avoids mid-spring retarget snap)
    const contentMs =
      ((allowCustom ? MORPH_MOVE_MS : 0) + n * MORPH_STAGGER + MORPH_MOVE_MS) *
      1000;
    const layoutMs = MORPH_LAYOUT.duration * 1000;
    const s = contentMs + layoutMs;
    const t = window.setTimeout(() => setIsCascadeExiting(false), s);
    return () => window.clearTimeout(t);
  }, [isCascadeExiting]);

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

      setAttachmentFiles((prev) => {
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - prev.length)
            : undefined;
        const capped =
          typeof capacity === "number"
            ? incoming.slice(0, capacity)
            : incoming;
        return [
          ...prev,
          ...capped.map((file) => ({
            filename: file.name,
            id: nanoid(),
            mediaType: file.type,
            type: "file" as const,
            url: URL.createObjectURL(file),
          })),
        ];
      });
    },
    [maxFiles]
  );

  const remove = useCallback((id: string) => {
    setAttachmentFiles((prev) => {
      const found = prev.find((f) => f.id === id);
      if (found?.url) {
        URL.revokeObjectURL(found.url);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachmentFiles((prev) => {
      for (const f of prev) {
        if (f.url) {
          URL.revokeObjectURL(f.url);
        }
      }
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
      for (const f of attachmentsRef.current) {
        if (f.url) {
          URL.revokeObjectURL(f.url);
        }
      }
    },
    []
  );

  const openFileDialog = useCallback(() => {
    openRef.current?.();
  }, []);

  const attachments = useMemo<AttachmentsContext>(
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

  const handleOptionSelect = useCallback((option: string) => {
    setTextInput(option);
  }, []);

  const controller = useMemo<PromptInputControllerProps>(
    () => ({
      __registerFileInput,
      attachments,
      textInput: {
        clear: clearInput,
        setInput: setTextInput,
        value: textInput,
      },
      askUserQuestionData,
      setAskUserQuestionData,
      handleOptionSelect,
      isCascadeExiting,
    }),
    [textInput, clearInput, attachments, __registerFileInput, askUserQuestionData, setAskUserQuestionData, handleOptionSelect, isCascadeExiting]
  );

  return (
    <PromptInputController.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputController.Provider>
  );
};

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputAttachments = () => {
  // Prefer local context (inside PromptInput) as it has validation, fall back to provider
  const provider = useOptionalProviderAttachments();
  const local = useContext(LocalAttachmentsContext);
  const context = local ?? provider;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    );
  }
  return context;
};

// ============================================================================
// Referenced Sources (Local to PromptInput)
// ============================================================================

export interface ReferencedSourcesContext {
  sources: (SourceDocumentUIPart & { id: string })[];
  add: (incoming: SourceDocumentUIPart[] | SourceDocumentUIPart) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const LocalReferencedSourcesContext = createContext<ReferencedSourcesContext | null>(null);


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

export type PromptInputActionAddScreenshotProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
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
  // Render a hidden input with given name and keep it in sync for native form posts. Default false.
  syncHiddenInput?: boolean;
  // Minimal constraints
  maxFiles?: number;
  // bytes
  maxFileSize?: number;
  onError?: (err: {
    code: "max_files" | "max_file_size" | "accept";
    message: string;
  }) => void;
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
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  // Try to use a provider controller if present
  const controller = useOptionalPromptInputController();
  const usingProvider = !!controller;

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // ----- Local attachments (only used when no provider)
  const [items, setItems] = useState<(FileUIPart & { id: string })[]>([]);
  const files = usingProvider ? controller.attachments.files : items;

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

  const matchesAccept = useCallback(
    (f: File) => {
      if (!accept || accept.trim() === "") {
        return true;
      }

      const patterns = accept
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return patterns.some((pattern) => {
        if (pattern.endsWith("/*")) {
          // e.g: image/* -> image/
          const prefix = pattern.slice(0, -1);
          return f.type.startsWith(prefix);
        }
        return f.type === pattern;
      });
    },
    [accept]
  );

  const addLocal = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = [...fileList];
      const accepted = incoming.filter((f) => matchesAccept(f));
      if (incoming.length && accepted.length === 0) {
        onError?.({
          code: "accept",
          message: "No files match the accepted types.",
        });
        return;
      }
      const withinSize = (f: File) =>
        maxFileSize ? f.size <= maxFileSize : true;
      const sized = accepted.filter(withinSize);
      if (accepted.length > 0 && sized.length === 0) {
        onError?.({
          code: "max_file_size",
          message: "All files exceed the maximum size.",
        });
        return;
      }

      setItems((prev) => {
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - prev.length)
            : undefined;
        const capped =
          typeof capacity === "number" ? sized.slice(0, capacity) : sized;
        if (typeof capacity === "number" && sized.length > capacity) {
          onError?.({
            code: "max_files",
            message: "Too many files. Some were not added.",
          });
        }
        const next: (FileUIPart & { id: string })[] = [];
        for (const file of capped) {
          next.push({
            filename: file.name,
            id: nanoid(),
            mediaType: file.type,
            type: "file",
            url: URL.createObjectURL(file),
          });
        }
        return [...prev, ...next];
      });
    },
    [matchesAccept, maxFiles, maxFileSize, onError]
  );

  const removeLocal = useCallback(
    (id: string) =>
      setItems((prev) => {
        const found = prev.find((file) => file.id === id);
        if (found?.url) {
          URL.revokeObjectURL(found.url);
        }
        return prev.filter((file) => file.id !== id);
      }),
    []
  );

  // Wrapper that validates files before calling provider's add
  const addWithProviderValidation = useCallback(
    (fileList: File[] | FileList) => {
      const incoming = [...fileList];
      const accepted = incoming.filter((f) => matchesAccept(f));
      if (incoming.length && accepted.length === 0) {
        onError?.({
          code: "accept",
          message: "No files match the accepted types.",
        });
        return;
      }
      const withinSize = (f: File) =>
        maxFileSize ? f.size <= maxFileSize : true;
      const sized = accepted.filter(withinSize);
      if (accepted.length > 0 && sized.length === 0) {
        onError?.({
          code: "max_file_size",
          message: "All files exceed the maximum size.",
        });
        return;
      }

      const currentCount = files.length;
      const capacity =
        typeof maxFiles === "number"
          ? Math.max(0, maxFiles - currentCount)
          : undefined;
      const capped =
        typeof capacity === "number" ? sized.slice(0, capacity) : sized;
      if (typeof capacity === "number" && sized.length > capacity) {
        onError?.({
          code: "max_files",
          message: "Too many files. Some were not added.",
        });
      }

      if (capped.length > 0) {
        controller?.attachments.add(capped);
      }
    },
    [matchesAccept, maxFileSize, maxFiles, onError, files.length, controller]
  );

  const clearAttachments = useCallback(
    () =>
      usingProvider
        ? controller?.attachments.clear()
        : setItems((prev) => {
            for (const file of prev) {
              if (file.url) {
                URL.revokeObjectURL(file.url);
              }
            }
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

  // Note: File input cannot be programmatically set for security reasons
  // The syncHiddenInput prop is no longer functional
  useEffect(() => {
    if (syncHiddenInput && inputRef.current && files.length === 0) {
      inputRef.current.value = "";
    }
  }, [files, syncHiddenInput]);

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    if (globalDrop) {
      // when global drop is on, let the document-level handler own drops
      return;
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  useEffect(() => {
    if (!globalDrop) {
      return;
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  useEffect(
    () => () => {
      if (!usingProvider) {
        for (const f of filesRef.current) {
          if (f.url) {
            URL.revokeObjectURL(f.url);
          }
        }
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

  const attachmentsCtx = useMemo<AttachmentsContext>(
    () => ({
      add,
      clear: clearAttachments,
      fileInputRef: inputRef,
      files: files.map((item) => ({ ...item, id: item.id })),
      openFileDialog,
      remove,
    }),
    [files, add, remove, clearAttachments, openFileDialog]
  );

  const refsCtx = useMemo<ReferencedSourcesContext>(
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

  const { 
    onDrag, onDragStart, onDragEnd, 
    onAnimationStart, onAnimationEnd, onAnimationIteration,
    ...restProps 
  } = props;

  // Render with or without local provider
  const isWidgetMode = usingProvider ? !!controller?.askUserQuestionData : false;

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
      <motion.form
        layout
        transition={MORPH_LAYOUT}
        className={cn("w-full", className)}
        onSubmit={handleSubmit}
        ref={formRef as any}
        {...restProps}
      >
        <MotionInputGroup 
          layout
          transition={MORPH_LAYOUT}
          // Always column: InputGroup only auto-flex-cols when a *direct* child has
          // data-align=block-*. Header may return null (empty chat); footer is wrapped
          // in motion.div for AnimatePresence — neither guarantees a direct align child.
          className="h-auto flex-col overflow-hidden"
        >
          {children}
        </MotionInputGroup>
      </motion.form>
    </>
  );

  const withReferencedSources = (
    <LocalReferencedSourcesContext.Provider value={refsCtx}>
      {inner}
    </LocalReferencedSourcesContext.Provider>
  );

  // Always provide LocalAttachmentsContext so children get validated add function
  return (
    <LocalAttachmentsContext.Provider value={attachmentsCtx}>
      {withReferencedSources}
    </LocalAttachmentsContext.Provider>
  );
};

// ============================================================================
// AskUserQuestion morph timing (shared enter/exit family)
// ============================================================================

/** Opacity + y duration for content & chrome */
const MORPH_MOVE_MS = 0.2;
/** Per option / cascade step */
const MORPH_STAGGER = 0.04;
/** Layout springs on form / InputGroup / body padding */
const MORPH_LAYOUT = { type: "spring" as const, bounce: 0, duration: 0.4 };
/** |y| offset — same magnitude both directions */
const MORPH_Y = 10;

/** Match InputGroupAddon block-* tokens: px-2.5 = 10px, pb-2/pt-2 = 8px */
const MORPH_PAD_X = 10;
const MORPH_PAD_Y = 8;

const contentExitDuration = (n: number, allowCustom: boolean): number => {
  const customOffset = allowCustom ? MORPH_MOVE_MS : 0;
  return customOffset + n * MORPH_STAGGER + MORPH_MOVE_MS;
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
  className,
  children,
  ...props
}: PromptInputBodyProps) => {
  const { 
    onDrag, onDragStart, onDragEnd, 
    onAnimationStart, onAnimationEnd, onAnimationIteration,
    ...restProps 
  } = props;
  const controller = useOptionalPromptInputController();
  const askData = controller?.askUserQuestionData;
  const isWidgetMode = !!askData;

  // Remember cascade meta after askData clears so exit hold / siblings stay coherent
  const cascadeMetaRef = useRef({ n: 0, allowCustom: false });
  if (askData) {
    cascadeMetaRef.current = {
      n: askData.options.length,
      allowCustom: askData.allowCustomInput,
    };
  }

  const n = askData ? askData.options.length : cascadeMetaRef.current.n;
  const allowCustom = askData ? askData.allowCustomInput : cascadeMetaRef.current.allowCustom;

  // LIFO: custom last-in / first-out. Options reverse after the custom beat.
  const optionExitDelay = allowCustom ? MORPH_MOVE_MS : 0;

  // Shared cascade-exit flag from provider (single timer for Body + Textarea)
  const isCascadeExiting = controller?.isCascadeExiting ?? false;

  // Layout chrome active while widget is open or cascade is still exiting
  const unitActive = isWidgetMode || isCascadeExiting;

  return (
    <motion.div 
      // layout off here — form + InputGroup already layout; nested layout overshoots top clip
      layout={false}
      // gap must be a number (px), never CSS "normal" — Motion cannot animate normal → 0
      style={{
        gap: unitActive ? WIDGET.STACK_GAP : 0,
      }}
      initial={{
        paddingLeft: 0,
        paddingRight: 0,
        paddingBottom: 0,
      }}
      animate={{
        // Align with InputGroupAddon chrome (10/8) so chat ↔ widget has no hard jump
        paddingLeft: unitActive ? WIDGET.PAD_X : 0,
        paddingRight: unitActive ? WIDGET.PAD_X : 0,
        paddingBottom: unitActive ? WIDGET.ROW_PAD_Y : 0,
      }}
      transition={MORPH_LAYOUT}
      className={cn("flex flex-col w-full", className)} 
      {...restProps}
    >
      <AnimatePresence>
        {isWidgetMode &&
          askData.options.map((opt, i) => (
            <motion.button
              key={opt}
              initial={{ opacity: 0, y: -MORPH_Y, height: 0, paddingTop: 0, paddingBottom: 0, overflow: "hidden" }}
              animate={{
                opacity: 1,
                y: 0,
                height: "auto",
                paddingTop: WIDGET.ROW_PAD_Y,
                paddingBottom: WIDGET.ROW_PAD_Y,
                overflow: "hidden",
                transition: {
                  duration: MORPH_MOVE_MS,
                  delay: i * MORPH_STAGGER,
                  height: { duration: MORPH_MOVE_MS, delay: i * MORPH_STAGGER },
                  paddingTop: { duration: MORPH_MOVE_MS, delay: i * MORPH_STAGGER },
                  paddingBottom: { duration: MORPH_MOVE_MS, delay: i * MORPH_STAGGER },
                },
              }}
              exit={{
                opacity: 0,
                y: -MORPH_Y,
                height: 0,
                paddingTop: 0,
                paddingBottom: 0,
                overflow: "hidden",
                transition: {
                  duration: MORPH_MOVE_MS,
                  // After custom fully done, reverse options: last → first
                  delay: optionExitDelay + (n - 1 - i) * MORPH_STAGGER,
                  // Nested props must carry the same delay or height collapses early
                  height: {
                    duration: MORPH_MOVE_MS,
                    delay: optionExitDelay + (n - 1 - i) * MORPH_STAGGER,
                  },
                  paddingTop: {
                    duration: MORPH_MOVE_MS,
                    delay: optionExitDelay + (n - 1 - i) * MORPH_STAGGER,
                  },
                  paddingBottom: {
                    duration: MORPH_MOVE_MS,
                    delay: optionExitDelay + (n - 1 - i) * MORPH_STAGGER,
                  },
                },
              }}
              style={{ gap: WIDGET.ROW_GAP }}
              type="button"
              aria-label={`Option ${i + 1}: ${opt}`}
              onClick={(e) => {
                const form = e.currentTarget.closest("form");
                controller?.handleOptionSelect?.(opt);
                flushSync(() => {});
                if (!(controller?.textInput.value === opt)) {
                  controller?.textInput.setInput(opt);
                }
                form?.requestSubmit();
              }}
              className="group flex flex-row items-center rounded-[var(--radius)] hover:bg-accent/10 transition-colors w-full text-left"
            >
              <div 
                style={{ width: WIDGET.BADGE, height: WIDGET.BADGE }} 
                className="shrink-0 flex items-center justify-center bg-accent/20 rounded-[0.4rem]"
              >
                <span className={WIDGET_TYPE.number}>{i + 1}</span>
              </div>
              <span className={cn(WIDGET_TYPE.option, "flex-grow min-w-0")}>{opt}</span>
              <DotMatrixIcon 
                name="cornerDownLeft" 
                size={16} 
                className="opacity-0 group-hover:opacity-100 text-text-primary transition-opacity shrink-0 mr-1"
              />
            </motion.button>
          ))}
      </AnimatePresence>
      {/*
        Custom row: textarea always mounted and always visible.
        Open: pencil enters left (gap opens → field nudged right).
        Close: pencil AnimatePresence exit only; gap closes → field expands left;
        field rides layout up as options/header height-collapse (true reverse).
      */}
      <motion.div 
        className={cn(
          "flex flex-row items-center w-full min-w-0",
          unitActive ? "hover:bg-accent/10 transition-colors" : ""
        )}
        // Solid flex gap (same as option rows) — do NOT rely on Motion-only animate.gap
        style={{
          gap:
            (isWidgetMode || isCascadeExiting) && allowCustom
              ? WIDGET.ROW_GAP
              : 0,
        }}
        initial={false}
        animate={{
          // Match option row vertical pad; horizontal comes from body PAD_X only
          paddingTop: unitActive ? WIDGET.ROW_PAD_Y : 0,
          paddingBottom: unitActive ? WIDGET.ROW_PAD_Y : 0,
          paddingLeft: 0,
          paddingRight: 0,
          borderRadius: unitActive ? "var(--radius)" : 0,
        }}
        transition={{
          paddingTop: MORPH_LAYOUT,
          paddingBottom: MORPH_LAYOUT,
          paddingLeft: MORPH_LAYOUT,
          paddingRight: MORPH_LAYOUT,
          borderRadius: MORPH_LAYOUT,
        }}
      >
        <AnimatePresence>
          {isWidgetMode && allowCustom && (
            <motion.div
              key="custom-pencil"
              initial={{
                opacity: 0,
                y: -MORPH_Y,
                width: 0,
                height: 0,
                overflow: "hidden",
              }}
              animate={{
                opacity: 1,
                y: 0,
                width: WIDGET.BADGE,
                height: WIDGET.BADGE,
                overflow: "hidden",
                transition: {
                  duration: MORPH_MOVE_MS,
                  delay: 0,
                  width: { duration: MORPH_MOVE_MS, delay: 0 },
                  height: { duration: MORPH_MOVE_MS, delay: 0 },
                  opacity: { duration: MORPH_MOVE_MS, delay: 0 },
                  y: { duration: MORPH_MOVE_MS, delay: 0 },
                },
              }}
              exit={{
                opacity: 0,
                y: -MORPH_Y,
                width: 0,
                height: 0,
                overflow: "hidden",
                transition: {
                  duration: MORPH_MOVE_MS,
                  delay: 0,
                  width: { duration: MORPH_MOVE_MS, delay: 0 },
                  height: { duration: MORPH_MOVE_MS, delay: 0 },
                  opacity: { duration: MORPH_MOVE_MS, delay: 0 },
                  y: { duration: MORPH_MOVE_MS, delay: 0 },
                },
              }}
              className="shrink-0"
            >
              <div 
                style={{ width: WIDGET.BADGE, height: WIDGET.BADGE }} 
                className="flex items-center justify-center bg-accent/20 rounded-[0.4rem]"
              >
                <DotMatrixIcon name="pencil" size={14} className="text-[#ded4f0]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-grow min-w-0 flex items-center">
          {children}
        </div>
      </motion.div>
    </motion.div>
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
  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();
  const [isComposing, setIsComposing] = useState(false);
  const askData = controller?.askUserQuestionData;
  const isWidgetMode = !!askData;

  // Compact min-height held through full content cascade on exit.
  const isCascadeExiting = controller?.isCascadeExiting ?? false;
  const allowCustom = askData?.allowCustomInput ?? false;

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      // Call the external onKeyDown handler first
      onKeyDown?.(e);

      // If the external handler prevented default, don't run internal logic
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

        // Check if the submit button is disabled before submitting
        const { form } = e.currentTarget;
        const submitButton = form?.querySelector(
          'button[type="submit"]'
        ) as HTMLButtonElement | null;
        if (submitButton?.disabled) {
          return;
        }

        form?.requestSubmit();
      }

      // Remove last attachment when Backspace is pressed and textarea is empty
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

  const [val, setVal] = useState(() => (controller ? controller.textInput.value : (props.value || props.defaultValue || "")));
  useEffect(() => {
    if (controller) {
      setVal(controller.textInput.value);
    }
  }, [controller, controller?.textInput.value]);

  useEffect(() => {
    if (!controller && props.value !== undefined) {
      setVal(props.value as string);
    }
  }, [props.value, controller]);

  const handleTextareaChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setVal(e.currentTarget.value);
    if (controller) {
      controller.textInput.setInput(e.currentTarget.value);
    }
    onChange?.(e);
  }, [controller, onChange]);

  const controlledProps = controller
    ? {
        value: controller.textInput.value,
      }
    : {};

  // Stay compact until full cascade settle — not only when custom input was on
  const isCompact = isWidgetMode || isCascadeExiting;

  const showCustomPlaceholder = isWidgetMode && allowCustom;
  const isEmpty = !val;

  // Placeholder sits inside the field column (after pencil+ROW_GAP siblings). Do not
  // add BADGE+ROW_GAP again — that double-offsets. Chat: align to PAD_X content inset.
  const placeholderLeft = isCompact ? 0 : WIDGET.PAD_X;

  const { style: propsStyle, ...restTextareaProps } = props;

  return (
    <div className="relative flex-grow min-w-0 flex items-center">
      <InputGroupTextarea
        className={cn(
          "field-sizing-content max-h-48 overflow-x-hidden transition-[min-height,padding] duration-400 ease-out w-full",
          WIDGET_TYPE.input,
          isCompact
            ? "bg-transparent border-none focus-visible:ring-0 shadow-none px-0 py-0 m-0 resize-none focus:outline-none placeholder:text-transparent"
            : "",
          className
        )}
        style={{
          ...propsStyle,
          minHeight: isCompact ? WIDGET.FIELD_MIN_H : WIDGET.CHAT_MIN_H,
          paddingLeft: isCompact ? 0 : WIDGET.PAD_X,
          paddingRight: isCompact ? 0 : WIDGET.PAD_X,
        }}
        name="message"
        aria-label="Message input"
        onCompositionEnd={handleCompositionEnd}
        onCompositionStart={handleCompositionStart}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder=""
        {...restTextareaProps}
        {...controlledProps}
        onChange={handleTextareaChange}
      />
      {isEmpty && (
        <AnimatePresence>
          {showCustomPlaceholder ? (
            <motion.span
              key="custom-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MORPH_MOVE_MS }}
              style={{ left: placeholderLeft }}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 pointer-events-none select-none",
                WIDGET_TYPE.placeholder
              )}
            >
              Or type your own...
            </motion.span>
          ) : (
            <motion.span
              key="default-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MORPH_MOVE_MS }}
              style={{ left: placeholderLeft }}
              className={cn(
                "absolute pointer-events-none select-none",
                isCompact ? "top-1/2 -translate-y-1/2" : "top-2.5",
                WIDGET_TYPE.placeholder
              )}
            >
              {placeholder}
            </motion.span>
          )}
        </AnimatePresence>
      )}
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
  const controller = useOptionalPromptInputController();
  const askData = controller?.askUserQuestionData;
  const isCascadeExiting = controller?.isCascadeExiting ?? false;

  // Remember last cascade length so header exit delay stays correct after askData clears.
  // Hooks must run unconditionally (before any early return) — Rules of Hooks.
  const cascadeRef = useRef({ n: 0, allowCustom: false });
  const lastQuestionRef = useRef("");
  if (askData) {
    cascadeRef.current = {
      n: askData.options.length,
      allowCustom: askData.allowCustomInput,
    };
    lastQuestionRef.current = askData.question;
  }
  const { n, allowCustom } = cascadeRef.current;
  const customOffset = allowCustom ? MORPH_MOVE_MS : 0;
  const headerExitDelay = customOffset + n * MORPH_STAGGER;

  // Presence follows askData so AnimatePresence gets a true exit when it clears.
  // Keep header *mounted* during isCascadeExiting so exit is not skipped by return null.
  const showQuestion = !!askData;
  const questionText = askData?.question ?? lastQuestionRef.current;

  // Empty header only after cascade settles (not mid-exit)
  if (
    !askData &&
    !isCascadeExiting &&
    Children.count(children) === 0
  ) {
    return null;
  }

  return (
    <InputGroupAddon
      align="block-start"
      className={cn("flex-col gap-1 items-start w-full", className)}
      {...props}
    >
      <AnimatePresence>
        {showQuestion && (
          <motion.div
            key="question-header"
            initial={{ opacity: 0, y: -MORPH_Y, height: 0, paddingTop: 0, paddingBottom: 0, overflow: "hidden" }}
            animate={{
              opacity: 1,
              y: 0,
              height: "auto",
              paddingTop: "8px",
              paddingBottom: "4px",
              overflow: "hidden",
              transition: {
                duration: MORPH_MOVE_MS,
                delay: 0,
                height: { duration: MORPH_MOVE_MS, delay: 0 },
                paddingTop: { duration: MORPH_MOVE_MS, delay: 0 },
                paddingBottom: { duration: MORPH_MOVE_MS, delay: 0 },
              },
            }}
            exit={{
              opacity: 0,
              y: -MORPH_Y,
              height: 0,
              paddingTop: 0,
              paddingBottom: 0,
              overflow: "hidden",
              transition: {
                duration: MORPH_MOVE_MS,
                delay: headerExitDelay,
                height: { duration: MORPH_MOVE_MS, delay: headerExitDelay },
                paddingTop: { duration: MORPH_MOVE_MS, delay: headerExitDelay },
                paddingBottom: {
                  duration: MORPH_MOVE_MS,
                  delay: headerExitDelay,
                },
              },
            }}
            // Addon already supplies px-2.5; only add top/bottom so we don't double horizontal pad
            className="pt-2 pb-1 w-full"
          >
            <p className={WIDGET_TYPE.question}>{questionText}</p>
          </motion.div>
        )}
      </AnimatePresence>
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
  const controller = useOptionalPromptInputController();
  const askData = controller?.askUserQuestionData;

  // Remember last cascade length so footer return delay stays correct after askData clears
  const cascadeRef = useRef({ n: 0, allowCustom: false });
  if (askData) {
    cascadeRef.current = {
      n: askData.options.length,
      allowCustom: askData.allowCustomInput,
    };
  }
  const { n, allowCustom } = cascadeRef.current;
  const isCascadeExiting = controller?.isCascadeExiting ?? false;
  // Widget + custom: keep footer. Chat: only after cascade so footer height doesn't fight collapse
  const showFooter = askData
    ? !!askData.allowCustomInput
    : isCascadeExiting
      ? allowCustom
      : true;
  const footerEnterDelay =
    askData || isCascadeExiting ? 0 : contentExitDuration(n, allowCustom);

  return (
    <AnimatePresence>
      {showFooter && (
        <motion.div
          key="footer"
          initial={{ opacity: 0, y: MORPH_Y }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: MORPH_MOVE_MS, delay: footerEnterDelay },
          }}
          exit={{
            opacity: 0,
            y: MORPH_Y,
            transition: { duration: MORPH_MOVE_MS },
          }}
          className="w-full flex-shrink-0 overflow-hidden"
          // Tools + submit move as one unit; no nested tools width animation
          layout={false}
        >
          <InputGroupAddon
            data-prompt-footer
            align="block-end"
            className={cn("justify-between gap-1", className)}
            {...props}
          >
            {children}
          </InputGroupAddon>
        </motion.div>
      )}
    </AnimatePresence>
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
        <DotMatrixIcon name="plus" size={16} />
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

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

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
      size={16}
      dotSize={2}
      dotShape="square"
      color="currentColor"
      animated={status === "submitted"}
    />
  );

  if (status === "streaming") {
    Icon = (
      <DotmHex9
        size={16}
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

export type PromptInputSelectProps = ComponentProps<typeof Select>;

export const PromptInputSelect = (props: PromptInputSelectProps) => (
  <Select {...props} />
);

export type PromptInputSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const PromptInputSelectTrigger = ({
  className,
  ...props
}: PromptInputSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className
    )}
    {...props}
  />
);

export type PromptInputSelectContentProps = ComponentProps<
  typeof SelectContent
>;

export const PromptInputSelectContent = ({
  className,
  ...props
}: PromptInputSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);

export type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputSelectItem = ({
  className,
  ...props
}: PromptInputSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;

export const PromptInputSelectValue = ({
  className,
  ...props
}: PromptInputSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);

export type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>;

export const PromptInputHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  ...props
}: PromptInputHoverCardProps) => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);

export type PromptInputHoverCardTriggerProps = ComponentProps<
  typeof HoverCardTrigger
>;

export const PromptInputHoverCardTrigger = (
  props: PromptInputHoverCardTriggerProps
) => <HoverCardTrigger {...props} />;

export type PromptInputHoverCardContentProps = ComponentProps<
  typeof HoverCardContent
>;

export const PromptInputHoverCardContent = ({
  align = "start",
  ...props
}: PromptInputHoverCardContentProps) => (
  <HoverCardContent align={align} {...props} />
);

export type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTabsList = ({
  className,
  ...props
}: PromptInputTabsListProps) => <div className={cn(className)} {...props} />;

export type PromptInputTabProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTab = ({
  className,
  ...props
}: PromptInputTabProps) => <div className={cn(className)} {...props} />;

export type PromptInputCommandProps = ComponentProps<typeof Command>;
export type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>;
export type PromptInputCommandListProps = ComponentProps<typeof CommandList>;
export type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>;
export type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>;
export type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>;
export type PromptInputCommandSeparatorProps = ComponentProps<
  typeof CommandSeparator
>;
