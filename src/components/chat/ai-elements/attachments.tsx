"use client";

/**
 * Presentational attachment primitives: Attachments, Attachment, AttachmentPreview,
 * AttachmentInfo, AttachmentRemove, AttachmentEmpty.
 *
 * <Attachment> defaults to a smart chip: Preview + Info (non-grid) + Remove
 * (overlay on hover/focus for grid/inline). Pass `children` to override
 * entirely — never combined with the default. No click-preview or dialog;
 * remove is the only affordance until a later PR.
 *
 * No attachment state here — these are pure UI chips driven by a context that the
 * shell (PromptInput / PromptInputProvider) provides. Bind to live state via
 * prompt-input-attachments.tsx.
 */

import { Button } from "@/components/ui/button";
import { DotMatrixIcon, type DotMatrixIconName } from "@/components/dotmatrix/icons";
import { cn } from "@/lib/utils";
import type { FileUIPart, SourceDocumentUIPart } from "ai";
import type {
  ComponentProps,
  HTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import { createContext, useCallback, useContext, useMemo } from "react";

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

export type AttachmentVariant = "grid" | "inline" | "list";

const mediaCategoryIcons: Record<
  AttachmentMediaCategory,
  { name: DotMatrixIconName; className: string }
> = {
  audio: { name: "mic", className: "size-4" },
  document: { name: "book", className: "size-4" },
  image: { name: "square", className: "size-4" },
  source: { name: "globe", className: "size-4" },
  unknown: { name: "book", className: "size-4" },
  video: { name: "arrowUp", className: "size-4" },
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

  const category = getMediaCategory(data);
  return data.filename || (category === "image" ? "Image" : "Attachment");
};

const renderAttachmentImage = (
  url: string,
  filename: string | undefined,
  isGrid: boolean
) =>
  isGrid ? (
    <img
      alt={filename || "Image"}
      className="size-full object-cover"
      height={96}
      src={url}
      width={96}
    />
  ) : (
    <img
      alt={filename || "Image"}
      className="size-full object-cover"
      height={20}
      src={url}
      width={20}
    />
  );

// ============================================================================
// Contexts
// ============================================================================

interface AttachmentsContextValue {
  variant: AttachmentVariant;
}

const AttachmentsContext = createContext<AttachmentsContextValue | null>(null);

interface AttachmentContextValue {
  data: AttachmentData;
  mediaCategory: AttachmentMediaCategory;
  onRemove?: () => void;
  variant: AttachmentVariant;
}

const AttachmentContext = createContext<AttachmentContextValue | null>(null);

// ============================================================================
// Hooks
// ============================================================================

export const useAttachmentsContext = () =>
  useContext(AttachmentsContext) ?? { variant: "grid" as const };

export const useAttachmentContext = () => {
  const ctx = useContext(AttachmentContext);
  if (!ctx) {
    throw new Error("Attachment components must be used within <Attachment>");
  }
  return ctx;
};

// ============================================================================
// Attachments - Container
// ============================================================================

export type AttachmentsProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AttachmentVariant;
};

export const Attachments = ({
  variant = "grid",
  className,
  children,
  ...props
}: AttachmentsProps) => {
  const contextValue = useMemo(() => ({ variant }), [variant]);

  return (
    <AttachmentsContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex items-start",
          variant === "list" ? "flex-col gap-2" : "flex-wrap gap-2",
          variant === "grid" && "ml-auto w-fit",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AttachmentsContext.Provider>
  );
};

// ============================================================================
// Attachment - Item
// ============================================================================

export type AttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: AttachmentData;
  onRemove?: () => void;
};

export const Attachment = ({
  data,
  onRemove,
  className,
  children,
  ...props
}: AttachmentProps) => {
  const { variant } = useAttachmentsContext();
  const mediaCategory = getMediaCategory(data);

  const contextValue = useMemo<AttachmentContextValue>(
    () => ({ data, mediaCategory, onRemove, variant }),
    [data, mediaCategory, onRemove, variant]
  );

  return (
    <AttachmentContext.Provider value={contextValue}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-[var(--radius)]",
          variant === "grid" && "size-24",
          variant === "inline" && [
            "flex h-8 max-w-[12rem] select-none items-center gap-1.5",
            "border border-border py-0 pl-1.5 pr-6",
            "font-medium text-sm text-foreground transition-colors",
            "hover:bg-accent/50",
          ],
          variant === "list" && [
            "flex w-full items-center gap-3 border p-3",
            "hover:bg-accent/50",
          ],
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove />
          </>
        )}
      </div>
    </AttachmentContext.Provider>
  );
};

// ============================================================================
// AttachmentPreview - Media preview
// ============================================================================

export type AttachmentPreviewProps = HTMLAttributes<HTMLDivElement> & {
  fallbackIcon?: ReactNode;
};

export const AttachmentPreview = ({
  fallbackIcon,
  className,
  ...props
}: AttachmentPreviewProps) => {
  const { data, mediaCategory, variant } = useAttachmentContext();

  const renderIcon = (entry: { name: DotMatrixIconName; className: string }) => (
    <DotMatrixIcon
      name={entry.name}
      size={variant === "inline" ? 12 : 16}
      className={cn("text-muted-foreground", entry.className)}
    />
  );

  const renderContent = () => {
    if (mediaCategory === "image" && data.type === "file" && data.url) {
      return renderAttachmentImage(data.url, data.filename, variant === "grid");
    }

    if (mediaCategory === "video" && data.type === "file" && data.url) {
      return <video className="size-full object-cover" muted src={data.url} />;
    }

    const entry = mediaCategoryIcons[mediaCategory];
    return fallbackIcon ?? renderIcon(entry);
  };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        variant === "grid" && "size-full bg-muted",
        variant === "inline" && "size-5 bg-background",
        variant === "list" && "size-12 bg-muted",
        className
      )}
      {...props}
    >
      {renderContent()}
    </div>
  );
};

// ============================================================================
// AttachmentInfo - Name and type display
// ============================================================================

export type AttachmentInfoProps = HTMLAttributes<HTMLDivElement> & {
  showMediaType?: boolean;
};

export const AttachmentInfo = ({
  showMediaType = false,
  className,
  ...props
}: AttachmentInfoProps) => {
  const { data, variant } = useAttachmentContext();
  const label = getAttachmentLabel(data);

  if (variant === "grid") {
    return null;
  }

  return (
    <div className={cn("min-w-0 flex-1", className)} {...props}>
      <span className="block truncate">{label}</span>
      {showMediaType && data.mediaType && (
        <span className="block truncate text-muted-foreground text-xs">
          {data.mediaType}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// AttachmentRemove - Remove button (overlay on hover/focus for grid/inline)
// ============================================================================

export type AttachmentRemoveProps = ComponentProps<typeof Button> & {
  label?: string;
};

export const AttachmentRemove = ({
  label = "Remove",
  className,
  children,
  ...props
}: AttachmentRemoveProps) => {
  const { onRemove, variant } = useAttachmentContext();

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove]
  );

  if (!onRemove) {
    return null;
  }

  return (
    <Button
      aria-label={label}
      className={cn(
        variant === "grid" && [
          "absolute top-2 right-2 size-6 p-0",
          "bg-background/80 backdrop-blur-sm",
          "opacity-0 transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          "focus-visible:opacity-100",
          "hover:bg-background",
          "[&>svg]:size-3",
        ],
        variant === "inline" && [
          "absolute top-1/2 right-1 size-4 -translate-y-1/2 p-0",
          "bg-background/80 backdrop-blur-sm",
          "opacity-0 transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          "focus-visible:opacity-100",
          "hover:bg-background",
          "[&>svg]:size-2.5",
        ],
        variant === "list" && ["size-8 shrink-0 p-0", "[&>svg]:size-4"],
        className
      )}
      onClick={handleClick}
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <DotMatrixIcon name="x" size={16} />}
      <span className="sr-only">{label}</span>
    </Button>
  );
};

// ============================================================================
// AttachmentEmpty - Empty state
// ============================================================================

export type AttachmentEmptyProps = HTMLAttributes<HTMLDivElement>;

export const AttachmentEmpty = ({
  className,
  children,
  ...props
}: AttachmentEmptyProps) => (
  <div
    className={cn(
      "flex items-center justify-center p-4 text-muted-foreground text-sm",
      className
    )}
    {...props}
  >
    {children ?? "No attachments"}
  </div>
);
