"use client";

import { AttachmentChip } from "@/components/chat/ai-elements/attachments";
import { usePromptInputAttachments } from "@/components/chat/ai-elements/prompt-input";
import { usePrefersReducedMotion } from "@/components/dotmatrix/hooks";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, HTMLAttributes } from "react";
import { useLayoutEffect, useRef, useState } from "react";

export type PromptInputAttachmentsProps = HTMLAttributes<HTMLDivElement>;

/**
 * Collapsible attachment strip.
 *
 * Height uses measured pixels (never height:"auto" alone on collapse).
 * On last-file remove we freeze the last good measured height — with
 * popLayout the exiting chip leaves flow immediately, so re-reading
 * scrollHeight would snap to padding-only before height→0.
 *
 * Mid-list removes keep measuring (neighbors slide via layout="position").
 */
export const PromptInputAttachments = ({
  className,
  ...props
}: PromptInputAttachmentsProps) => {
  const attachments = usePromptInputAttachments();
  const reduced = usePrefersReducedMotion();

  const hasFiles = attachments.files.length > 0;

  const [isOpen, setIsOpen] = useState(hasFiles);
  const [contentHeight, setContentHeight] = useState(0);
  const [heightFrozen, setHeightFrozen] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  // Latest files for onExitComplete race guard (avoid effect re-runs).
  const filesRef = useRef(attachments.files);
  filesRef.current = attachments.files;
  const heightFrozenRef = useRef(heightFrozen);
  heightFrozenRef.current = heightFrozen;
  // Last good measured height while chips were in-flow (not padding-only).
  const previousContentHeightRef = useRef(0);
  const roRafRef = useRef<number | null>(null);

  const commitContentHeight = (height: number) => {
    previousContentHeightRef.current = height;
    setContentHeight(height);
  };

  // Open immediately when files appear; freeze last good height when last
  // file is removed so popLayout exit cannot snap strip to padding-only.
  useLayoutEffect(() => {
    if (hasFiles) {
      setHeightFrozen(false);
      setIsOpen(true);
      const el = contentRef.current;
      if (el) {
        commitContentHeight(el.scrollHeight);
      }
      return;
    }

    // files.length === 0: do NOT remeasure — popLayout already removed the
    // chip from flow; scrollHeight would be padding-only and cause a snap.
    setContentHeight(previousContentHeightRef.current);
    setHeightFrozen(true);
  }, [hasFiles]);

  // Measure while open and not frozen (ResizeObserver tracks chip enter/wrap).
  useLayoutEffect(() => {
    if (!isOpen || heightFrozen) return;

    const el = contentRef.current;
    if (!el) return;

    commitContentHeight(el.scrollHeight);

    const ro = new ResizeObserver(() => {
      if (heightFrozenRef.current) return;
      if (roRafRef.current !== null) return;
      roRafRef.current = requestAnimationFrame(() => {
        roRafRef.current = null;
        if (heightFrozenRef.current) return;
        const node = contentRef.current;
        if (node) {
          commitContentHeight(node.scrollHeight);
        }
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (roRafRef.current !== null) {
        cancelAnimationFrame(roRafRef.current);
        roRafRef.current = null;
      }
    };
  }, [isOpen, heightFrozen, attachments.files.length]);

  const heightTransition = reduced
    ? { duration: 0 }
    : isOpen
      ? { duration: 0.2, ease: "easeOut" as const }
      : { duration: 0.2, ease: "easeIn" as const };

  const chipTransition = reduced
    ? { duration: 0 }
    : {
        duration: 0.2,
        ease: "easeOut" as const,
        layout: { duration: 0.2, ease: "easeOut" as const },
      };

  const chipExitTransition = reduced
    ? { duration: 0 }
    : { duration: 0.15, ease: "easeIn" as const };

  return (
    <motion.div
      initial={false}
      animate={{ height: isOpen ? contentHeight : 0 }}
      transition={heightTransition}
      className={cn("overflow-hidden", className)}
      {...(props as ComponentProps<typeof motion.div>)}
    >
      {/*
        Symmetric padding always on content. Collapsed height 0 + overflow
        hidden clips it — never strip py when isOpen flips mid-animation.
      */}
      <div
        ref={contentRef}
        className={cn("flex flex-wrap gap-2 px-2.5 py-2")}
      >
        <AnimatePresence
          initial={false}
          mode="popLayout"
          onExitComplete={() => {
            // Race guard: only collapse if no new files arrived during exit.
            if (filesRef.current.length === 0) {
              setIsOpen(false);
            } else {
              setHeightFrozen(false);
              setIsOpen(true);
            }
          }}
        >
          {attachments.files.map((attachment) => (
            <motion.div
              key={attachment.id}
              layout={reduced ? false : "position"}
              initial={reduced ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: -4,
                transition: chipExitTransition,
              }}
              transition={chipTransition}
            >
              <AttachmentChip
                data={attachment}
                onRemove={() => attachments.remove(attachment.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
