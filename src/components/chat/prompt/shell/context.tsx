"use client";

/**
 * Prompt shell draft context: text, attachments, and chat prefs (model / mode / web).
 * Requires outer PromptShellProvider. Must NOT import header/body/footer.
 *
 * PromptInput registers file-input open + attachment validation so children
 * always hit a validated `attachments.add` while state lives only here.
 * Selector open flags stay local to the call site (not in this context).
 */

import {
  filesToFileUIParts,
  revokeFileUrls,
} from "../attachments/prompt-input-files";
import { models } from "@/lib/models";
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

/** Chat request prefs owned by the prompt shell (not stream state). */
export interface PromptInputPrefsValue {
  model: string;
  setModel: (id: string) => void;
  mode: string;
  setMode: (mode: string) => void;
  useWebSearch: boolean;
  setUseWebSearch: (enabled: boolean) => void;
  toggleWebSearch: () => void;
}

/** Lifted controller state exposed by PromptShellProvider. */
export interface PromptShellControllerValue {
  textInput: TextInputValue;
  attachments: AttachmentsValue;
  prefs: PromptInputPrefsValue;
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

const PromptShellControllerContext =
  createContext<PromptShellControllerValue | null>(null);

/** Optional: returns null when outside PromptShellProvider. */
export const useOptionalPromptShellControllerContext = () =>
  useContext(PromptShellControllerContext);

/** Required: throws when outside PromptShellProvider. */
export const usePromptShellControllerContext =
  (): PromptShellControllerValue => {
    const controller = useContext(PromptShellControllerContext);
    if (!controller) {
      throw new Error(
        "usePromptShellControllerContext must be used within a PromptShellProvider"
      );
    }
    return controller;
  };

/**
 * Attachments from the single draft controller.
 * Throws when outside PromptShellProvider.
 */
export const usePromptInputAttachments = (): AttachmentsValue => {
  const controller = useContext(PromptShellControllerContext);
  if (!controller) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptShellProvider"
    );
  }
  return controller.attachments;
};

// ============================================================================
// Provider
// ============================================================================

const DEFAULT_MODEL_ID = models[0]?.id ?? "deepseek-v4-flash";
const DEFAULT_MODE = "high";
const DEFAULT_USE_WEB_SEARCH = true;

export type PromptShellProviderProps = PropsWithChildren<{
  initialInput?: string;
  maxFiles?: number;
  initialModel?: string;
  initialMode?: string;
  initialUseWebSearch?: boolean;
}>;

/**
 * Owns prompt draft state (text + attachments + prefs). Required wrapper for
 * PromptInput and consumers of usePromptInputAttachments / controller hooks.
 */
export const PromptShellProvider = ({
  initialInput: initialTextInput = "",
  maxFiles,
  initialModel = DEFAULT_MODEL_ID,
  initialMode = DEFAULT_MODE,
  initialUseWebSearch = DEFAULT_USE_WEB_SEARCH,
  children,
}: PromptShellProviderProps) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  // ----- prefs (model / mode / web) — no selector open flags
  const [model, setModel] = useState(initialModel);
  const [mode, setMode] = useState(initialMode);
  const [useWebSearch, setUseWebSearch] = useState(initialUseWebSearch);
  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);

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

  const prefs = useMemo<PromptInputPrefsValue>(
    () => ({
      model,
      setModel,
      mode,
      setMode,
      useWebSearch,
      setUseWebSearch,
      toggleWebSearch,
    }),
    [model, mode, useWebSearch, toggleWebSearch]
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

  const controller = useMemo<PromptShellControllerValue>(
    () => ({
      __registerAttachmentValidator,
      __registerFileInput,
      attachments,
      prefs,
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
      prefs,
      __registerFileInput,
      __registerAttachmentValidator,
    ]
  );

  return (
    <PromptShellControllerContext.Provider value={controller}>
      {children}
    </PromptShellControllerContext.Provider>
  );
};
