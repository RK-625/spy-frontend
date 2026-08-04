"use client";

/**
 * PromptInputHeader: block-start InputGroupAddon for attachment strip etc.
 */

import { InputGroupAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Children } from "react";

export type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

export const PromptInputHeader = ({
  className,
  children,
  ...props
}: PromptInputHeaderProps) => {
  if (Children.count(children) === 0) {
    return null;
  }

  return (
    <InputGroupAddon
      align="block-start"
      className={cn("flex-col gap-0 items-start w-full px-0 pt-0 pb-0", className)}
      {...props}
    >
      {children}
    </InputGroupAddon>
  );
};
