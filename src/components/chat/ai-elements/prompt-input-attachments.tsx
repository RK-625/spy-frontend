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
 * On last-file remove we freeze the current contentHeight state (last good
 * measure) — with popLayout the exiting chip leaves flow immediately, so
 * re-reading scrollHeight would snap to padding-only before height→0.
 *
 * Mid-list removes keep measuring (neighbors slide via layout="position").
 *
 * Open/freeze follows hasFiles via render-time state adjust (not setState in
 * effect). contentHeight is not rewritten on empty — it already holds the
 * last good px. Refs for async RO / onExitComplete sync in layout effects only.
 */
export const PromptInputAttachments = ({
  className,
  ...props
}: PromptInputAttachmentsProps) => {
  const attachments = usePromptInputAttachments();
  const reduced = usePrefersReducedMotion();

  const hasFiles = attachments.files.length > 0;

  const contentRef = useRef<HTMLDivElement>(null);
  const filesRef = useRef(attachments.files);
  const heightFrozenRef = useRef(false);
  const roRafRef = useRef<number | null>(null);

  const [contentHeight, setContentHeight] = useState(0);
  const [heightFrozen, setHeightFrozen] = useState(false);
  /** Keep strip expanded after last remove until exit animation finishes. */
  const [holdOpen, setHoldOpen] = useState(false);
  const [prevHasFiles, setPrevHasFiles] = useState(hasFiles);

  // Adjust open/freeze when file presence flips — during render, not in an effect.
  // contentHeight is left alone on empty: it still holds the last good measure.
  if (hasFiles !== prevHasFiles) {
    setPrevHasFiles(hasFiles);
    if (hasFiles) {
      setHeightFrozen(false);
      setHoldOpen(false);
    } else {
      // Freeze only — never remeasure under popLayout (padding-only snap).
      setHeightFrozen(true);
      setHoldOpen(true);
    }
  }

  const isOpen = hasFiles || holdOpen;

  // Sync callback refs after commit — never assign ref.current during render.
  useLayoutEffect(() => {
    filesRef.current = attachments.files;
  }, [attachments.files]);

  useLayoutEffect(() => {
    heightFrozenRef.current = heightFrozen;
  }, [heightFrozen]);

  // Measure while open and not frozen (ResizeObserver tracks chip enter/wrap).
  useLayoutEffect(() => {
    if (!isOpen || heightFrozen) return;

    const el = contentRef.current;
    if (!el) return;

    setContentHeight(el.scrollHeight);

    const ro = new ResizeObserver(() => {
      if (heightFrozenRef.current) return;
      if (filesRef.current.length === 0) return;
      if (roRafRef.current !== null) return;
      roRafRef.current = requestAnimationFrame(() => {
        roRafRef.current = null;
        if (heightFrozenRef.current) return;
        if (filesRef.current.length === 0) return;
        const node = contentRef.current;
        if (node) {
          setContentHeight(node.scrollHeight);
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
              setHoldOpen(false);
            } else {
              setHeightFrozen(false);
              setHoldOpen(false);
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
