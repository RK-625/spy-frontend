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
  attachmentToDraft,
  draftToAttachment,
  filesToFileUIParts,
  revokeFileUrls,
  type PromptAttachmentItem,
} from "../attachments/prompt-input-files";
import { models } from "@/lib/models";
import {
  deletePromptDraft,
  getPromptDraft,
  savePromptDraft,
  type PromptDraftRecord,
  type StoredDraftAttachment,
} from "@/lib/storage/prompt-draft-store";
import type { PropsWithChildren, RefObject } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// Types
// ============================================================================

/** Attachment store API (context value shape, not a React context). */
export interface AttachmentsValue {
  files: PromptAttachmentItem[];
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

function persistPromptDraft(
  id: string,
  current: {
    attachmentFiles: PromptAttachmentItem[];
    mode: string;
    model: string;
    textInput: string;
    useExcalidraw: boolean;
    useWebSearch: boolean;
  },
  hydrated: boolean,
  interacted: boolean,
) {
  if (!id || !hydrated || !interacted) return;

  const attachmentsToStore = current.attachmentFiles
    .map(attachmentToDraft)
    .filter((a): a is StoredDraftAttachment => a !== null);

  const isDefaultSettings =
    current.model === DEFAULT_PROMPT_PREFS.model &&
    current.mode === DEFAULT_PROMPT_PREFS.mode &&
    current.useWebSearch === DEFAULT_PROMPT_PREFS.useWebSearch &&
    current.useExcalidraw === DEFAULT_PROMPT_PREFS.useExcalidraw;

  const isEmptyDraft =
    current.textInput.trim() === "" &&
    attachmentsToStore.length === 0 &&
    isDefaultSettings;

  if (isEmptyDraft) {
    void deletePromptDraft(id);
  } else {
    const record: PromptDraftRecord = {
      attachments: attachmentsToStore,
      chatId: id,
      mode: current.mode,
      model: current.model,
      text: current.textInput,
      updatedAt: Date.now(),
      useExcalidraw: current.useExcalidraw,
      useWebSearch: current.useWebSearch,
    };
    void savePromptDraft(record);
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
  const [textInput, setTextInput] = useState("");
  const [model, setModel] = useState(DEFAULT_PROMPT_PREFS.model);
  const [mode, setMode] = useState(DEFAULT_PROMPT_PREFS.mode);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(
    DEFAULT_PROMPT_PREFS.useWebSearch
  );
  const [useExcalidraw, setUseExcalidraw] = useState<boolean>(
    DEFAULT_PROMPT_PREFS.useExcalidraw
  );
  const [attachmentFiles, setAttachmentFiles] = useState<PromptAttachmentItem[]>([]);

  const isHydratedRef = useRef<boolean>(false);
  const hasInteractedRef = useRef<boolean>(false);
  const chatIdRef = useRef(chatId);

  const registeredInputRef = useRef<RefObject<HTMLInputElement | null> | null>(null);
  const validatorRef = useRef<AttachmentAddValidator | null>(null);

  // Snapshot ref of current draft state to avoid stale closures in callbacks/timers/unload
  const draftRef = useRef({
    attachmentFiles,
    mode,
    model,
    textInput,
    useExcalidraw,
    useWebSearch,
  });

  useEffect(() => {
    draftRef.current = {
      attachmentFiles,
      mode,
      model,
      textInput,
      useExcalidraw,
      useWebSearch,
    };
  }, [
    attachmentFiles,
    mode,
    model,
    textInput,
    useExcalidraw,
    useWebSearch,
  ]);

  const flushSave = useCallback(() => {
    persistPromptDraft(
      chatId,
      draftRef.current,
      isHydratedRef.current,
      hasInteractedRef.current,
    );
  }, [chatId]);

  const applyComposerDraft = useCallback(
    (draft: PromptDraftRecord | null | undefined) => {
      setTextInput(draft?.text ?? "");
      setModel(draft?.model || DEFAULT_PROMPT_PREFS.model);
      setMode(draft?.mode || DEFAULT_PROMPT_PREFS.mode);
      setUseWebSearch(
        draft?.useWebSearch ?? DEFAULT_PROMPT_PREFS.useWebSearch,
      );
      setUseExcalidraw(
        draft?.useExcalidraw ?? DEFAULT_PROMPT_PREFS.useExcalidraw,
      );
      setAttachmentFiles((prev) => {
        revokeFileUrls(prev);
        return (draft?.attachments || []).map(draftToAttachment);
      });
    },
    [],
  );

  const handleClearDraft = useCallback(() => {
    hasInteractedRef.current = false;
    setTextInput("");
    setAttachmentFiles((prev) => {
      revokeFileUrls(prev);
      return [];
    });
    void deletePromptDraft(chatId);
  }, [chatId]);

  const clearInput = useCallback(() => {
    setTextInput("");
  }, []);

  const handleSetTextInput = useCallback((v: string) => {
    hasInteractedRef.current = true;
    setTextInput(v);
  }, []);

  const handleSetModel = useCallback((id: string) => {
    hasInteractedRef.current = true;
    setModel(id);
  }, []);

  const handleSetMode = useCallback((m: string) => {
    hasInteractedRef.current = true;
    setMode(m);
  }, []);

  const handleSetUseWebSearch = useCallback((enabled: boolean) => {
    hasInteractedRef.current = true;
    setUseWebSearch(enabled);
  }, []);

  const toggleWebSearch = useCallback(() => {
    hasInteractedRef.current = true;
    setUseWebSearch((prev) => !prev);
  }, []);

  const handleSetUseExcalidraw = useCallback((enabled: boolean) => {
    hasInteractedRef.current = true;
    setUseExcalidraw(enabled);
  }, []);

  const toggleExcalidraw = useCallback(() => {
    hasInteractedRef.current = true;
    setUseExcalidraw((prev) => !prev);
  }, []);

  useLayoutEffect(() => {
    const previousId = chatIdRef.current;
    if (previousId !== chatId) {
      persistPromptDraft(
        previousId,
        {
          attachmentFiles,
          mode,
          model,
          textInput,
          useExcalidraw,
          useWebSearch,
        },
        isHydratedRef.current,
        hasInteractedRef.current,
      );
      hasInteractedRef.current = false;
      isHydratedRef.current = false;
      applyComposerDraft(null);
    }
    chatIdRef.current = chatId;
    // Snapshot is this render's composer; only run when the active chat changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chatId transition
  }, [chatId, applyComposerDraft]);

  useEffect(() => {
    let isActive = true;

    getPromptDraft(chatId)
      .then((draft) => {
        if (!isActive) {
          return;
        }
        if (!hasInteractedRef.current) {
          applyComposerDraft(draft);
        }
        isHydratedRef.current = true;
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        if (!hasInteractedRef.current) {
          applyComposerDraft(null);
        }
        isHydratedRef.current = true;
      });

    return () => {
      isActive = false;
    };
  }, [chatId, applyComposerDraft]);

  // Debounced auto-save (400ms)
  useEffect(() => {
    if (!isHydratedRef.current || !hasInteractedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      flushSave();
    }, 400);

    return () => clearTimeout(timer);
  }, [
    textInput,
    model,
    mode,
    useWebSearch,
    useExcalidraw,
    attachmentFiles,
    flushSave,
  ]);

  // Persist + revoke blob URLs only when the provider unmounts (not on chatId / flushSave identity change).
  useEffect(() => {
    const handleBeforeUnload = () => {
      persistPromptDraft(
        chatIdRef.current,
        draftRef.current,
        isHydratedRef.current,
        hasInteractedRef.current,
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      persistPromptDraft(
        chatIdRef.current,
        draftRef.current,
        isHydratedRef.current,
        hasInteractedRef.current,
      );
      revokeFileUrls(draftRef.current.attachmentFiles);
    };
  }, []);

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
      hasInteractedRef.current = true;
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
    hasInteractedRef.current = true;
  }, []);

  const clear = useCallback(() => {
    setAttachmentFiles((prev) => {
      revokeFileUrls(prev);
      return [];
    });
  }, []);

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
      mode,
      model,
      setMode: handleSetMode,
      setModel: handleSetModel,
      setUseExcalidraw: handleSetUseExcalidraw,
      setUseWebSearch: handleSetUseWebSearch,
      toggleExcalidraw,
      toggleWebSearch,
      useExcalidraw,
      useWebSearch,
    }),
    [
      mode,
      model,
      handleSetMode,
      handleSetModel,
      handleSetUseExcalidraw,
      handleSetUseWebSearch,
      toggleExcalidraw,
      toggleWebSearch,
      useExcalidraw,
      useWebSearch,
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
