import type { FileUIPart } from "ai";
import { nanoid } from "nanoid";

export type AttachmentError = {
  code: "max_files" | "max_file_size" | "accept";
  message: string;
};

export function matchesAccept(file: File, accept?: string): boolean {
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
      return file.type.startsWith(prefix);
    }
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
