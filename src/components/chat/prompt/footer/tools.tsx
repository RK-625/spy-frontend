"use client";

/**
 * PromptInputTools: horizontal row for footer tool buttons.
 */

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  children,
  ...props
}: PromptInputToolsProps) => {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );
};
