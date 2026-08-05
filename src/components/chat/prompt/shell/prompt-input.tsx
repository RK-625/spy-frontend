"use client";

/**
 * PromptInput form: drop handlers, submit pipeline, file input + validation registration.
 * Requires outer PromptInputProvider. Draft state lives in ./context.
 */

import { InputGroup } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import type { PromptInputMessage } from "@/types/chat";
import type { FileUIPart } from "ai";
import {
  convertBlobUrlToDataUrl,
  filterIncomingFiles,
  type AttachmentError,
} from "../attachments/prompt-input-files";
import type {
  ChangeEventHandler,
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
} from "react";
import { useCallback, useEffect, useRef } from "react";
import { usePromptInputControllerContext } from "./context";

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
  const controller = usePromptInputControllerContext();
  const { attachments, textInput } = controller;

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Latest validation props for the registered gate (stable registration effect)
  const validationRef = useRef({ accept, maxFileSize, maxFiles, onError });
  validationRef.current = { accept, maxFileSize, maxFiles, onError };

  // Register file input so external openFileDialog() works
  useEffect(() => {
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [controller]);

  // Register accept/size/maxFiles gate so attachments.add is always validated
  // while PromptInput is mounted (children, drop, file picker share one path).
  useEffect(() => {
    controller.__registerAttachmentValidator((files, { currentCount }) => {
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
      controller.__registerAttachmentValidator(null);
    };
  }, [controller]);

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
