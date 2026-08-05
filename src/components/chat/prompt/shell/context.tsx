"use client";

/**
 * Prompt shell draft context: single controller for text + attachments.
 * Requires outer PromptInputProvider. Must NOT import header/body/footer.
 *
 * PromptInput registers file-input open + attachment validation so children
 * always hit a validated `attachments.add` while state lives only here.
 */

import {
  filesToFileUIParts,
  revokeFileUrls,
} from "../attachments/prompt-input-files";
import type { FileUIPart } from "ai";
import type { PropsWithChildren, RefObject } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// Types
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

/**
 * Validates/filters incoming files before they are appended.
 * Return the files to store (may be empty). Receives current attachment count.
 */
export type AttachmentAddValidator = (
  files: File[] | FileList,
  ctx: { currentCount: number }
) => File[];

/** Lifted controller state exposed by PromptInputProvider. */
export interface PromptInputControllerValue {
  textInput: TextInputValue;
  attachments: AttachmentsValue;
  /** INTERNAL: PromptInput registers its hidden file input + open callback */
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void;
  /**
   * INTERNAL: PromptInput registers accept/size/maxFiles validation.
   * Pass null on unmount. While set, `attachments.add` runs through it.
   */
  __registerAttachmentValidator: (
    validate: AttachmentAddValidator | null
  ) => void;
}

// ============================================================================
// Context
// ============================================================================

const PromptInputControllerContext =
  createContext<PromptInputControllerValue | null>(null);

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

/**
 * Attachments from the single draft controller.
 * Throws when outside PromptInputProvider.
 */
export const usePromptInputAttachments = (): AttachmentsValue => {
  const controller = useContext(PromptInputControllerContext);
  if (!controller) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInputProvider"
    );
  }
  return controller.attachments;
};

// ============================================================================
// Provider
// ============================================================================

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
  maxFiles?: number;
}>;

/**
 * Owns prompt draft state (text + attachments). Required wrapper for PromptInput
 * and any consumer of usePromptInputAttachments / controller hooks.
 */
export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  maxFiles,
  children,
}: PromptInputProviderProps) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  // ----- attachments state
  const [attachmentFiles, setAttachmentFiles] = useState<
    (FileUIPart & { id: string })[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // oxlint-disable-next-line eslint(no-empty-function)
  const openRef = useRef<() => void>(() => {});
  const validatorRef = useRef<AttachmentAddValidator | null>(null);

  const add = useCallback(
    (files: File[] | FileList) => {
      setAttachmentFiles((prev) => {
        let toAdd: File[];
        if (validatorRef.current) {
          toAdd = validatorRef.current(files, { currentCount: prev.length });
        } else {
          const incoming = [...files];
          if (incoming.length === 0) {
            return prev;
          }
          // No PromptInput gate yet: soft maxFiles cap only
          const capacity =
            typeof maxFiles === "number"
              ? Math.max(0, maxFiles - prev.length)
              : undefined;
          toAdd =
            typeof capacity === "number"
              ? incoming.slice(0, capacity)
              : incoming;
        }
        if (toAdd.length === 0) {
          return prev;
        }
        return [...prev, ...filesToFileUIParts(toAdd)];
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

  const __registerAttachmentValidator = useCallback(
    (validate: AttachmentAddValidator | null) => {
      validatorRef.current = validate;
    },
    []
  );

  const controller = useMemo<PromptInputControllerValue>(
    () => ({
      __registerAttachmentValidator,
      __registerFileInput,
      attachments,
      textInput: {
        clear: clearInput,
        setValue: setTextInput,
        value: textInput,
      },
    }),
    [
      textInput,
      clearInput,
      attachments,
      __registerFileInput,
      __registerAttachmentValidator,
    ]
  );

  return (
    <PromptInputControllerContext.Provider value={controller}>
      {children}
    </PromptInputControllerContext.Provider>
  );
};
