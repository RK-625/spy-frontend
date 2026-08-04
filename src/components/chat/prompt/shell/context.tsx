"use client";

/**
 * Prompt shell contexts, provider, and hooks.
 * Owns attachment/text/controller/sources store shapes and dual-path hooks.
 * Must NOT import header/body/footer (cycle prevention).
 */

import {
  filesToFileUIParts,
  revokeFileUrls,
} from "../attachments/prompt-input-files";
import type { FileUIPart, SourceDocumentUIPart } from "ai";
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

/** Local attachments context (validated add inside PromptInput). Used by shell form. */
export const LocalAttachmentsContext = createContext<AttachmentsValue | null>(
  null
);

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

/** Local referenced-sources context. Used by shell form. */
export const LocalReferencedSourcesContext =
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
