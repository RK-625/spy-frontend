"use client";

/**
 * Pending-ask widget leaves: question header + option chip.
 * Body owns layout; these are presentation-only leaves.
 */

import { cn } from "@/lib/utils";
import type { PendingAskUserQuestion } from "@/lib/ask-user-question";

export type PromptInputWidgetOption = PendingAskUserQuestion["options"][number];
export type PromptInputWidgetResponse = [
  {
    question: PendingAskUserQuestion["question"];
    response: PendingAskUserQuestion["options"][number];
  }
];

export type PromptInputQuestionProps = {
  id: string;
  children: string;
};

/**
 * Widget-mode question header — leaf only; no card/border/bg.
 * Body owns H gutter (`--prompt-body-px/py`); leaves have no horizontal pad.
 */
export function PromptInputQuestion({
  id,
  children,
}: PromptInputQuestionProps) {
  return (
    <p
      id={id}
      data-slot="prompt-input-question"
      className="w-full min-w-0 text-left text-base font-semibold leading-snug text-text-primary line-clamp-2"
    >
      {children}
    </p>
  );
}

export type PromptInputOptionProps = {
  option: PromptInputWidgetOption;
  onSelect?: (option: PromptInputWidgetOption) => void;
};

/**
 * Widget-mode option chip — leaf only; group shell stays on Body.
 * Body owns H gutter; leaves have no horizontal pad.
 */
export function PromptInputOption({
  option,
  onSelect,
}: PromptInputOptionProps) {
  return (
    <button
      type="button"
      data-slot="prompt-input-option"
      className={cn(
        "w-full min-h-8 rounded-[var(--radius)] py-2 text-left text-sm text-text-primary",
        "transition-colors outline-none",
        "hover:bg-[var(--surface-hover)]",
        "focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={() => {
        onSelect?.(option);
      }}
    >
      {option.label}
    </button>
  );
}
