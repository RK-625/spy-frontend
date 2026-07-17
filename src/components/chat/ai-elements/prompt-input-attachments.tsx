"use client";

/**
 * Prompt-shell attachment strip: binds usePromptInputAttachments() to the
 * presentational Attachments primitives. Lives next to the compound prompt API
 * (not route pages). Presentational chips remain in attachments.tsx.
 */

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
  type AttachmentsProps,
} from "@/components/chat/ai-elements/attachments";
import { usePromptInputAttachments } from "@/components/chat/ai-elements/prompt-input";
import type { FileUIPart } from "ai";
import { useCallback, type ComponentProps } from "react";

type PromptAttachment = FileUIPart & { id: string };

const PromptInputAttachmentItem = ({
  attachment,
  onRemove,
}: {
  attachment: PromptAttachment;
  onRemove: (id: string) => void;
}) => {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id);
  }, [onRemove, attachment.id]);

  return (
    <Attachment data={attachment} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
};

export type PromptInputAttachmentsProps = Omit<
  ComponentProps<typeof Attachments>,
  "children" | "variant"
> & {
  /** Layout variant for the chip strip. Default: inline (header strip). */
  variant?: AttachmentsProps["variant"];
};

/**
 * Renders current prompt draft attachments inside PromptInput / Provider.
 * Returns null when empty so PromptInputHeader can collapse.
 */
export const PromptInputAttachments = ({
  variant = "inline",
  className,
  ...props
}: PromptInputAttachmentsProps) => {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id);
    },
    [attachments],
  );

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant={variant} className={className} {...props}>
      {attachments.files.map((attachment) => (
        <PromptInputAttachmentItem
          attachment={attachment}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  );
};
