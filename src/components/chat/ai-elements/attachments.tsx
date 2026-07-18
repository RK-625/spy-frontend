"use client";

import { DotMatrixIcon, type DotMatrixIconName } from "@/components/dotmatrix/icons";
import { cn } from "@/lib/utils";
import type { FileUIPart, SourceDocumentUIPart } from "ai";
import type { HTMLAttributes } from "react";
import { useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type AttachmentData =
  | (FileUIPart & { id: string })
  | (SourceDocumentUIPart & { id: string });

export type AttachmentMediaCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "source"
  | "unknown";

const mediaCategoryIcons: Record<
  AttachmentMediaCategory,
  { name: DotMatrixIconName }
> = {
  audio: { name: "mic" },
  document: { name: "book" },
  image: { name: "square" },
  source: { name: "globe" },
  unknown: { name: "book" },
  video: { name: "arrowUp" },
};

// ============================================================================
// Utility Functions
// ============================================================================

export const getMediaCategory = (
  data: AttachmentData
): AttachmentMediaCategory => {
  if (data.type === "source-document") {
    return "source";
  }

  const mediaType = data.mediaType ?? "";

  if (mediaType.startsWith("image/")) {
    return "image";
  }
  if (mediaType.startsWith("video/")) {
    return "video";
  }
  if (mediaType.startsWith("audio/")) {
    return "audio";
  }
  if (mediaType.startsWith("application/") || mediaType.startsWith("text/")) {
    return "document";
  }

  return "unknown";
};

export const getAttachmentLabel = (data: AttachmentData): string => {
  if (data.type === "source-document") {
    return data.title || data.filename || "Source";
  }
  return data.filename || "Attachment";
};

// ============================================================================
// AttachmentChip
// ============================================================================

export type AttachmentChipProps = HTMLAttributes<HTMLDivElement> & {
  data: AttachmentData;
  onRemove?: () => void;
};

export const AttachmentChip = ({
  data,
  onRemove,
  className,
  ...props
}: AttachmentChipProps) => {
  const mediaCategory = getMediaCategory(data);
  const label = getAttachmentLabel(data);
  const entry = mediaCategoryIcons[mediaCategory];

  const handleRemove = useCallback(() => {
    onRemove?.();
  }, [onRemove]);

  const showImage =
    mediaCategory === "image" && data.type === "file" && data.url;

  return (
    <div
      className={cn(
        "group relative shrink-0 size-14 rounded-[var(--radius)] border border-border bg-muted select-none",
        className
      )}
      title={data.type === "file" ? data.filename : label}
      {...props}
    >
      {showImage ? (
        <img
          alt={data.filename || "Image"}
          className="size-full object-cover rounded-[var(--radius)]"
          height={56}
          src={data.url}
          width={56}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <DotMatrixIcon
            name={entry.name}
            size={20}
            className="text-muted-foreground"
          />
        </div>
      )}

      {onRemove && (
        <button
          aria-label="Remove"
          className={cn(
            "absolute top-0.5 right-0.5 z-10 size-5 p-0",
            "flex items-center justify-center",
            "bg-background/85 backdrop-blur-sm rounded-[var(--radius)]",
            "opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "focus-visible:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          type="button"
        >
          <DotMatrixIcon name="x" size={12} className="text-muted-foreground" />
          <span className="sr-only">Remove</span>
        </button>
      )}
    </div>
  );
};
