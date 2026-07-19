"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { DotmTriangle16 } from "@/components/dotmatrix/triangle-16";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn("flex flex-col gap-6 p-4", className)}
    {...props}
  />
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: 8, scale: 0.95, x: "-50%" }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="absolute bottom-4 left-[50%] z-30"
        >
          <Button
            className={cn(
              "!size-8 !rounded-[var(--radius)] transition-colors duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              "bg-[#e8dff8] text-[#0a0a0c] hover:bg-[var(--accent-hover)]",
              className
            )}
            onClick={handleScrollToBottom}
            size="icon"
            type="button"
            variant="default"
            {...props}
          >
            <DotmTriangle16
              size={ICON_GLYPH.toolbar}
              dotSize={2}
              dotShape="square"
              color="currentColor"
              animated={false}
              className="rotate-180"
            />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


