"use client";

import { cn } from "@/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { FileUIPart, UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageAttachmentsProps = HTMLAttributes<HTMLDivElement>;

export const MessageAttachments = ({
  className,
  ...props
}: MessageAttachmentsProps) => (
  <div
    className={cn(
      "flex flex-row flex-wrap gap-2",
      "group-[.is-user]:ml-auto",
      className
    )}
    {...props}
  />
);

function fileExtensionLabel(part: FileUIPart): string {
  const filename = part.filename;
  if (filename?.includes(".")) {
    const ext = filename.slice(filename.lastIndexOf(".") + 1).trim();
    if (ext.length > 0) {
      return ext.toUpperCase();
    }
  }

  return "FILE";
}

export type MessageFileProps = Omit<HTMLAttributes<HTMLDivElement>, "part"> & {
  part: FileUIPart;
};

export const MessageFile = ({
  part,
  className,
  ...props
}: MessageFileProps) => {
  const showImage =
    part.mediaType.startsWith("image/") && Boolean(part.url);

  return (
    <div
      className={cn(
        "size-14 shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-muted select-none",
        className
      )}
      title={part.filename}
      {...props}
    >
      {showImage ? (
        <img
          alt={part.filename || "Image"}
          className="size-full object-cover"
          src={part.url}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <span className="max-w-full truncate px-1 text-center font-[family-name:var(--font-terminal)] text-[0.55rem] leading-none tracking-wide text-muted-foreground uppercase">
            {fileExtensionLabel(part)}
          </span>
        </div>
      )}
    </div>
  );
};

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

const streamdownPlugins = { cjk, code, math, mermaid };

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={streamdownPlugins}
      controls={{
        table: { copy: true, download: false, fullscreen: false },
        code: { copy: true, download: false },
        mermaid: {
          copy: true,
          download: false,
          fullscreen: true,
          panZoom: false,
        },
      }}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    nextProps.isAnimating === prevProps.isAnimating
);

MessageResponse.displayName = "MessageResponse";
