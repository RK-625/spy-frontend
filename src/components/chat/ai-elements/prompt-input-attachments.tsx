"use client";

/**
 * Prompt-shell attachment strip: binds usePromptInputAttachments() to the
 * presentational Attachment primitive. Each item is rendered with the smart
 * default chip (preview + info + overlay-remove). Compound escapes are
 * available by importing Attachments/Attachment directly from attachments.tsx.
 *
 * Lives next to the compound prompt API (not route pages). Presentational chips
 * remain in attachments.tsx.
 */

import {
  Attachment,
  Attachments,
  type AttachmentsProps,
} from "@/components/chat/ai-elements/attachments";
import { usePromptInputAttachments } from "@/components/chat/ai-elements/prompt-input";
import type { ComponentProps } from "react";

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

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant={variant} className={className} {...props}>
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        />
      ))}
    </Attachments>
  );
};