"use client";

/**
 * PromptInputSubmit: submit / stop control with status glyph animation.
 */

import { InputGroupButton } from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";
import type { ChatStatus } from "ai";
import { DotmTriangle16 } from "@/components/dotmatrix";
import { DotmHex9 } from "@/components/dotmatrix";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps } from "react";
import { useCallback } from "react";

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const isGenerating = status === "submitted" || status === "streaming";

  const iconKey = status || "ready";
  let Icon = (
    <DotmTriangle16
      size={ICON_GLYPH.toolbar}
      dotSize={2}
      dotShape="square"
      color="currentColor"
      animated={status === "submitted"}
    />
  );

  if (status === "streaming") {
    Icon = (
      <DotmHex9
        size={ICON_GLYPH.toolbar}
        dotSize={2.5}
        dotShape="square"
        color="currentColor"
        animated={true}
      />
    );
  }

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isGenerating && onStop) {
        e.preventDefault();
        onStop();
        return;
      }
      onClick?.(e);
    },
    [isGenerating, onStop, onClick]
  );

  return (
    <InputGroupButton
      aria-label={isGenerating ? "Stop" : "Submit"}
      className={cn(className)}
      onClick={handleClick}
      size={size}
      type={isGenerating && onStop ? "button" : "submit"}
      variant={variant}
      {...props}
    >
      {children ?? (
        <AnimatePresence mode="wait">
          <motion.div
            key={iconKey}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            {Icon}
          </motion.div>
        </AnimatePresence>
      )}
    </InputGroupButton>
  );
};
