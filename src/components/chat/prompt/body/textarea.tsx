"use client";

/**
 * PromptInputTextarea: controlled by PromptShellProvider draft text.
 * Requires outer PromptShellProvider.
 */

import { InputGroupTextarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  ChangeEvent,
  ClipboardEventHandler,
  ComponentProps,
  KeyboardEventHandler,
} from "react";
import { useCallback, useState } from "react";
import {
  usePromptInputAttachments,
  usePromptShellControllerContext,
} from "../shell/context";

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
>;

export const PromptInputTextarea = ({
  onChange,
  onKeyDown,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const controller = usePromptShellControllerContext();
  const attachments = usePromptInputAttachments();
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (e) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) {
        return;
      }

      if (e.key === "Enter") {
        if (isComposing || e.nativeEvent.isComposing) {
          return;
        }
        if (e.shiftKey) {
          return;
        }
        e.preventDefault();

        const { form } = e.currentTarget;
        const submitButton = form?.querySelector(
          'button[type="submit"]'
        ) as HTMLButtonElement | null;
        if (submitButton?.disabled) {
          return;
        }

        form?.requestSubmit();
      }

      if (
        e.key === "Backspace" &&
        e.currentTarget.value === "" &&
        attachments.files.length > 0
      ) {
        e.preventDefault();
        const lastAttachment = attachments.files.at(-1);
        if (lastAttachment) {
          attachments.remove(lastAttachment.id);
        }
      }
    },
    [onKeyDown, isComposing, attachments]
  );

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      const items = event.clipboardData?.items;

      if (!items) {
        return;
      }

      const files: File[] = [];

      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        event.preventDefault();
        attachments.add(files);
      }
    },
    [attachments]
  );

  const handleCompositionEnd = useCallback(() => setIsComposing(false), []);
  const handleCompositionStart = useCallback(() => setIsComposing(true), []);

  const textValue = controller.textInput.value;

  const handleTextareaChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      controller.textInput.setValue(e.currentTarget.value);
      onChange?.(e);
    },
    [controller, onChange],
  );

  const isEmpty = !textValue;
  const { style: propsStyle, ...restTextareaProps } = props;

  return (
    <div className="relative flex w-full min-w-0 flex-grow">
      <InputGroupTextarea
        className={cn(
          // Body owns H gutter; leaves have no horizontal pad.
          // min-h / py-0 beat ui/textarea min-h-16 + InputGroupTextarea py-2.
          "field-sizing-content max-h-48 w-full resize-none overflow-x-hidden !px-0 !py-0",
          "min-h-[var(--prompt-textarea-min-h)] !min-h-[var(--prompt-textarea-min-h)]",
          "text-sm leading-5 text-text-primary placeholder:text-text-secondary",
          className
        )}
        style={propsStyle}
        name="message"
        aria-label="Message input"
        onCompositionEnd={handleCompositionEnd}
        onCompositionStart={handleCompositionStart}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={isEmpty ? placeholder : ""}
        {...restTextareaProps}
        value={textValue}
        onChange={handleTextareaChange}
      />
    </div>
  );
};
