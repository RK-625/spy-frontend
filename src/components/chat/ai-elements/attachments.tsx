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

/**
 * Compact attachment preview chip.
 * Remove control is a restrained-radius rectangular badge (not a pill/circle):
 * on small hit-targets, full `--radius` (~0.55rem) reads as circular, so the
 * badge uses a tighter radius token.
 */
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
        "group relative shrink-0 size-14 overflow-visible rounded-[var(--radius)] border border-border bg-muted select-none",
        className
      )}
      title={data.type === "file" ? data.filename : label}
      {...props}
    >
      <div className="size-full overflow-hidden rounded-[var(--radius)]">
        {showImage ? (
          <img
            alt={data.filename || "Image"}
            className="size-full object-cover"
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
      </div>

      {onRemove && (
        <button
          aria-label="Remove attachment"
          className={cn(
            // Boxy badge: hangs on top-right of preview; not circular.
            "absolute -top-1 -right-1 z-10",
            "inline-flex size-[18px] items-center justify-center p-0",
            // Tighter than --radius so a ~18px control stays rectangular.
            "rounded-[calc(var(--radius)*0.45)]",
            "bg-background/85 text-muted-foreground backdrop-blur-sm",
            "ring-1 ring-[var(--border-subtle)]",
            "opacity-0 transition-opacity duration-150",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "focus-visible:opacity-100 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            "hover:text-foreground"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          type="button"
        >
          <DotMatrixIcon name="x" size={10} className="text-current" />
          <span className="sr-only">Remove</span>
        </button>
      )}
    </div>
  );
};
