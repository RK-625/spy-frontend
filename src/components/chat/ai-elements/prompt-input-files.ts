/**
 * Pure helpers for the prompt-input attachment pipeline.
 * No JSX, no React state — only utilities that can be unit-tested in isolation.
 *
 * The string `PROMPT_INPUT_ACCEPT` below is the single source of truth for the
 * product allowlist used by the chat prompt at /home (and any future docs surface).
 * Pass it to <PromptInput accept={PROMPT_INPUT_ACCEPT} /> — validation runs on
 * add (filterIncomingFiles), so the <input accept="…"> attribute stays consistent
 * with what we actually accept in code.
 */
import type { FileUIPart } from "ai";
import { nanoid } from "nanoid";

export type AttachmentError = {
  code: "max_files" | "max_file_size" | "accept";
  message: string;
};

/**
 * Product allowlist: images plus common docs/code. Edit here, not at call sites.
 * Used by <PromptInput accept={PROMPT_INPUT_ACCEPT} /> in src/app/home/page.tsx.
 */
export const PROMPT_INPUT_ACCEPT =
  "image/*,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx";

export function matchesAccept(file: File, accept?: string): boolean {
  if (!accept || accept.trim() === "") {
    return true;
  }

  const patterns = accept
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const lowerName = file.name.toLowerCase();

  return patterns.some((pattern) => {
    // 1) type wildcard, e.g. image/*
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1); // "image/"
      return file.type.startsWith(prefix);
    }
    // 2) extension, e.g. .pdf, .ts
    if (pattern.startsWith(".")) {
      return lowerName.endsWith(pattern.toLowerCase());
    }
    // 3) exact MIME, e.g. application/pdf
    return file.type === pattern;
  });
}

/**
 * Filter incoming files by accept, size, and capacity.
 * Calls onError with the same messages as the previous addLocal path.
 */
export function filterIncomingFiles(
  fileList: File[] | FileList,
  options: {
    accept?: string;
    maxFileSize?: number;
    maxFiles?: number;
    currentCount: number;
    onError?: (err: AttachmentError) => void;
  }
): File[] {
  const { accept, maxFileSize, maxFiles, currentCount, onError } = options;
  const incoming = [...fileList];
  const accepted = incoming.filter((f) => matchesAccept(f, accept));

  if (incoming.length && accepted.length === 0) {
    onError?.({
      code: "accept",
      message: "No files match the accepted types.",
    });
    return [];
  }

  const withinSize = (f: File) =>
    maxFileSize ? f.size <= maxFileSize : true;
  const sized = accepted.filter(withinSize);

  if (accepted.length > 0 && sized.length === 0) {
    onError?.({
      code: "max_file_size",
      message: "All files exceed the maximum size.",
    });
    return [];
  }

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

  return capped;
}

export function filesToFileUIParts(
  files: File[]
): (FileUIPart & { id: string })[] {
  return files.map((file) => ({
    filename: file.name,
    id: nanoid(),
    mediaType: file.type,
    type: "file" as const,
    url: URL.createObjectURL(file),
  }));
}

export function revokeFileUrls(files: { url?: string }[]): void {
  for (const f of files) {
    if (f.url) {
      URL.revokeObjectURL(f.url);
    }
  }
}

export async function convertBlobUrlToDataUrl(
  url: string
): Promise<string | null> {
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
}
