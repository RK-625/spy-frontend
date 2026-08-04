"use client";

/**
 * PromptInput form: drop handlers, submit pipeline, nested attachment/sources providers.
 * State types and hooks live in ./context. UI pieces compose as children at the call site.
 */

import { InputGroup } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import type { PromptInputMessage } from "@/types/chat";
import type { FileUIPart, SourceDocumentUIPart } from "ai";
import {
  convertBlobUrlToDataUrl,
  filesToFileUIParts,
  filterIncomingFiles,
  revokeFileUrls,
  type AttachmentError,
} from "../attachments/prompt-input-files";
import { nanoid } from "nanoid";
import type {
  ChangeEventHandler,
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LocalAttachmentsContext,
  LocalReferencedSourcesContext,
  useOptionalPromptInputControllerContext,
  type AttachmentsValue,
  type ReferencedSourcesValue,
} from "./context";

// PROMPT_INPUT_ACCEPT lives in attachments/prompt-input-files; re-exported via
// barrel, root prompt-input shim, and ai-elements for historical import paths.

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
