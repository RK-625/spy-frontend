"use client";

/**
 * PromptInputBody: optional pending-ask chrome + children (typically textarea).
 */

import type { PendingAskUserQuestion } from "@/lib/ask-user-question";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import { useId } from "react";
import {
  PromptInputOption,
  PromptInputQuestion,
  type PromptInputWidgetOption,
} from "../ask/pending-ask";

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement> & {
  pendingAsk?: PendingAskUserQuestion | null;
  onOptionSelect?: (option: PromptInputWidgetOption) => void;
};

export const PromptInputBody = ({
  className,
  children,
  pendingAsk = null,
  onOptionSelect,
  ...props
}: PromptInputBodyProps) => {
  const questionId = useId();
  const isWidgetMode = pendingAsk != null;
  const questionText = pendingAsk?.question.trim() ?? "";
  const options = pendingAsk?.options ?? [];
  const showQuestion = isWidgetMode && questionText.length > 0;
  const showOptions = isWidgetMode && options.length > 0;
  // Options-only when custom write-in is disallowed.
  const showTextarea =
    pendingAsk == null || pendingAsk.allowCustomInput;

  return (
    /* Body owns H gutter (tokens --prompt-body-px/py); leaves have no horizontal pad. */
    <div
      className={cn(
        "flex w-full min-w-0 px-prompt-body-x py-prompt-body-y",
        className,
      )}
      {...props}
    >
      {/* Thin shell: layout only (`flex-col gap-2` when widget) — no pad.
          Widget column aligns at Body content edge. */}
      <div
        className={cn(
          "w-full min-w-0",
          isWidgetMode && "flex flex-col gap-2",
        )}
      >
        {showQuestion ? (
          <PromptInputQuestion id={questionId}>
            {questionText}
          </PromptInputQuestion>
        ) : null}
        {showOptions ? (
          <div
            className="flex flex-col gap-1"
            data-slot="prompt-input-options"
            role="group"
            {...(showQuestion
              ? { "aria-labelledby": questionId }
              : { "aria-label": "Options" })}
          >
            {options.map((option) => (
              <PromptInputOption
                key={option.id}
                option={option}
                onSelect={onOptionSelect}
              />
            ))}
          </div>
        ) : null}
        {/* Textarea last when shown; omitted for forced-choice pending asks. */}
        {showTextarea ? children : null}
      </div>
    </div>
  );
};
