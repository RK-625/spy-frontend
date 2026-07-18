"use client";

import { AttachmentChip } from "@/components/chat/ai-elements/attachments";
import { usePromptInputAttachments } from "@/components/chat/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type PromptInputAttachmentsProps = HTMLAttributes<HTMLDivElement>;

/**
 * Renders current prompt draft attachments as an inline horizontal chip strip.
 * Returns null when empty so the prompt header can collapse cleanly.
 */
export const PromptInputAttachments = ({
  className,
  ...props
}: PromptInputAttachmentsProps) => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-start flex-wrap gap-2", className)} {...props}>
      {attachments.files.map((attachment) => (
        <AttachmentChip
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        />
      ))}
    </div>
  );
};
