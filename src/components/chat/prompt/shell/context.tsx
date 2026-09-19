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
  clearDraft: () => void;
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

/** Storage key helper for prompt draft persistence */
export const getDraftKey = (chatId: string) => `spy:draft:${chatId}`;

/** Clear draft storage key helper */
export const clearDraft = (chatId: string) => {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(getDraftKey(chatId));
    } catch {
      // ignore storage errors
    }
  }
};

export interface PromptDraftState {
  text: string;
  model: string;
  mode: string;
  useWebSearch: boolean;
  useExcalidraw: boolean;
}

/** Default model / mode / web / excalidraw prefs when the provider mounts. */
export const DEFAULT_PROMPT_PREFS = {
  model: models[0]?.id ?? "deepseek-flash",
  mode: models[0]?.defaultMode ?? "high",
  useWebSearch: true,
  useExcalidraw: false,
} satisfies Pick<
  PromptInputPrefsValue,
  "model" | "mode" | "useWebSearch" | "useExcalidraw"
>;

export function loadPromptDraft(chatId: string): PromptDraftState {
  if (typeof window === "undefined") {
    return { text: "", ...DEFAULT_PROMPT_PREFS };
  }
  try {
    const raw = localStorage.getItem(getDraftKey(chatId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PromptDraftState>;
      if (typeof parsed?.text === "string") {
        return {
          text: parsed.text,
          model: parsed.model ?? DEFAULT_PROMPT_PREFS.model,
          mode: parsed.mode ?? DEFAULT_PROMPT_PREFS.mode,
          useWebSearch:
            parsed.useWebSearch ?? DEFAULT_PROMPT_PREFS.useWebSearch,
          useExcalidraw:
            parsed.useExcalidraw ?? DEFAULT_PROMPT_PREFS.useExcalidraw,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { text: "", ...DEFAULT_PROMPT_PREFS };
}

export function persistDraft(
  id: string,
  draft: PromptDraftState,
  initialDraft: PromptDraftState
): void {
  // Diff check: if nothing was changed during this session, skip write completely!
  const isDirty =
    draft.text !== initialDraft.text ||
    draft.model !== initialDraft.model ||
    draft.mode !== initialDraft.mode ||
    draft.useWebSearch !== initialDraft.useWebSearch ||
    draft.useExcalidraw !== initialDraft.useExcalidraw;

  if (!isDirty) {
    return;
  }

  try {
    const isModified =
      draft.text.trim() !== "" ||
      draft.model !== DEFAULT_PROMPT_PREFS.model ||
      draft.mode !== DEFAULT_PROMPT_PREFS.mode ||
      draft.useWebSearch !== DEFAULT_PROMPT_PREFS.useWebSearch ||
      draft.useExcalidraw !== DEFAULT_PROMPT_PREFS.useExcalidraw;

    if (isModified) {
      localStorage.setItem(getDraftKey(id), JSON.stringify(draft));
    } else {
      localStorage.removeItem(getDraftKey(id));
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Owns prompt draft state (text + attachments + prefs). Required wrapper for
 * PromptInput and consumers of usePromptInputContext.
 */
export const PromptInputProvider = ({
  children,
  chatId,
}: PropsWithChildren<{ chatId: string }>) => {
  /* eslint-disable react-hooks/refs -- synchronous initial draft read and ref sync */
  const initialDraftRef = useRef<PromptDraftState | null>(null);
  if (!initialDraftRef.current) {
    initialDraftRef.current = loadPromptDraft(chatId);
  }
  const initial = initialDraftRef.current;
  const [textInput, setTextInput] = useState(initial.text);
  const [model, setModel] = useState(initial.model);
  const [mode, setMode] = useState(initial.mode);
  const [useWebSearch, setUseWebSearch] = useState(initial.useWebSearch);
  const [useExcalidraw, setUseExcalidraw] = useState(initial.useExcalidraw);

  const draftRef = useRef({
    text: textInput,
    model,
    mode,
    useWebSearch,
    useExcalidraw,
  });
  draftRef.current = {
    text: textInput,
    model,
    mode,
    useWebSearch,
    useExcalidraw,
  };
  /* eslint-enable react-hooks/refs */

  const handleClearDraft = useCallback(() => {
    draftRef.current.text = "";
    clearDraft(chatId);
  }, [chatId]);

  const clearInput = useCallback(() => {
    draftRef.current.text = "";
    setTextInput("");
    handleClearDraft();
  }, [handleClearDraft]);

  const handleSetTextInput = useCallback((v: string) => {
    setTextInput(v);
  }, []);

  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);

  const toggleExcalidraw = useCallback(() => {
    setUseExcalidraw((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      persistDraft(chatId, draftRef.current, initial);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      persistDraft(chatId, draftRef.current, initial);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial draft captured at mount
  }, [chatId]);

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
      clearDraft: handleClearDraft,
      prefs,
      textInput: {
        clear: clearInput,
        setValue: handleSetTextInput,
        value: textInput,
      },
    }),
    [
      __registerAttachmentValidator,
      __registerFileInput,
      attachments,
      handleClearDraft,
      prefs,
      clearInput,
      handleSetTextInput,
      textInput,
    ]
  );

  return (
    <PromptInputContext.Provider value={value}>
      {children}
    </PromptInputContext.Provider>
  );
};
