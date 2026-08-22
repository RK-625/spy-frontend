"use client";

/**
 * Prompt input draft context: text, attachments, and chat prefs
 * (model / mode / web / excalidraw).
 * Requires outer PromptInputProvider. Must NOT import header/body/footer.
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
  currentCount: number
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
  useExcalidraw: boolean;
  setUseExcalidraw: (enabled: boolean) => void;
  toggleExcalidraw: () => void;
}

/** Draft + prefs state exposed by PromptInputProvider. */
export interface PromptInputContextValue {
  textInput: TextInputValue;
  attachments: AttachmentsValue;
  prefs: PromptInputPrefsValue;
  /** INTERNAL: PromptInput registers hidden file input ref */
  __registerFileInput: (ref: RefObject<HTMLInputElement | null>) => void;
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

const PromptInputContext = createContext<PromptInputContextValue | null>(null);

/** Required: throws when outside PromptInputProvider. */
export const usePromptInputContext = (): PromptInputContextValue => {
  const value = useContext(PromptInputContext);
  if (!value) {
    throw new Error(
      "usePromptInputContext must be used within a PromptInputProvider"
    );
  }
  return value;
};

// ============================================================================
// Provider
// ============================================================================

/** Default model / mode / web / excalidraw prefs when the provider mounts. */
export const DEFAULT_PROMPT_PREFS = {
  model: models[0]?.id ?? "deepseek-v4-flash",
  mode: models[0]?.defaultMode ?? "high",
  useWebSearch: true,
  useExcalidraw: false,
} satisfies Pick<
  PromptInputPrefsValue,
  "model" | "mode" | "useWebSearch" | "useExcalidraw"
>;

/**
 * Owns prompt draft state (text + attachments + prefs). Required wrapper for
 * PromptInput and consumers of usePromptInputContext.
 */
export const PromptInputProvider = ({ children }: PropsWithChildren) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState("");
  const clearInput = useCallback(() => setTextInput(""), []);

  // ----- prefs (model / mode / web / excalidraw) — no selector open flags
  const [model, setModel] = useState(DEFAULT_PROMPT_PREFS.model);
  const [mode, setMode] = useState<string>(DEFAULT_PROMPT_PREFS.mode);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(
    DEFAULT_PROMPT_PREFS.useWebSearch,
  );
  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);
  const [useExcalidraw, setUseExcalidraw] = useState<boolean>(
    DEFAULT_PROMPT_PREFS.useExcalidraw,
  );
  const toggleExcalidraw = useCallback(() => {
    setUseExcalidraw((prev) => !prev);
  }, []);

  // ----- attachments state
  const [attachmentFiles, setAttachmentFiles] = useState<
    (FileUIPart & { id: string })[]
  >([]);
  const registeredInputRef = useRef<RefObject<HTMLInputElement | null> | null>(
    null
  );
  const validatorRef = useRef<AttachmentAddValidator | null>(null);

  const add = useCallback(
    (files: File[] | FileList) => {
      setAttachmentFiles((prev) => {
        let toAdd: File[];
        if (validatorRef.current) {
          toAdd = validatorRef.current(files, prev.length);
        } else {
          const incoming = [...files];
          if (incoming.length === 0) {
            return prev;
          }
          toAdd = incoming;
        }
        if (toAdd.length === 0) {
          return prev;
        }
        return [...prev, ...filesToFileUIParts(toAdd)];
      });
    },
    []
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
    registeredInputRef.current?.current?.click();
  }, []);

  const attachments = useMemo<AttachmentsValue>(
    () => ({
      add,
      clear,
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
      useExcalidraw,
      setUseExcalidraw,
      toggleExcalidraw,
    }),
    [
      model,
      mode,
      useWebSearch,
      toggleWebSearch,
      useExcalidraw,
      toggleExcalidraw,
    ]
  );

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>) => {
      registeredInputRef.current = ref;
    },
    []
  );

  const __registerAttachmentValidator = useCallback(
    (validate: AttachmentAddValidator | null) => {
      validatorRef.current = validate;
    },
    []
  );

  const value = useMemo<PromptInputContextValue>(
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
    <PromptInputContext.Provider value={value}>
      {children}
    </PromptInputContext.Provider>
  );
};
