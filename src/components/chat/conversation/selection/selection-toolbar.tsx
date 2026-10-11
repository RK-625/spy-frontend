"use client";

import { autoUpdate, flip, FloatingPortal, inline, offset, shift, useFloating } from "@floating-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, MessageSquarePlus } from "lucide-react";
import { Button, toast } from "@/components/ui";
import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import { readMessageSelection, type MessageExcerpt, type MessageSelection } from "./message-selection";

export function MessageSelectionToolbar({ chatId, onAddQuote }: {
  chatId: string;
  onAddQuote: (excerpt: MessageExcerpt) => void;
}) {
  const [selection, setSelection] = useState<MessageSelection | null>(null);
  const [copied, setCopied] = useState(false);
  const selectionRef = useRef<MessageSelection | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { refs: { setReference, setPositionReference, setFloating }, floatingStyles } = useFloating({
    open: selection !== null,
    placement: "top",
    strategy: "fixed",
    middleware: [inline(), offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useCallback(() => {
    selectionRef.current = null;
    setSelection(null);
    setCopied(false);
  }, []);

  useEffect(() => {
    const scope = document.querySelector<HTMLElement>("[data-chat-selection-scope]");
    if (!scope) return;
    setReference(scope);
    const updateSelection = () => {
      if (toolbarRef.current?.contains(document.activeElement)) return;
      const next = readMessageSelection(window.getSelection(), scope);
      selectionRef.current = next;
      setSelection(next);
      setCopied(false);
      if (next) {
        setPositionReference({
          contextElement: scope,
          getBoundingClientRect: () => next.range.getBoundingClientRect(),
          getClientRects: () => next.range.getClientRects(),
        });
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectionRef.current) return;
      if (event.key === "Escape") {
        dismiss();
      } else if (event.key === "Tab" && !event.shiftKey && !toolbarRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        toolbarRef.current?.querySelector("button")?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !toolbarRef.current?.contains(event.target)) dismiss();
    };
    document.addEventListener("selectionchange", updateSelection);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("selectionchange", updateSelection);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("scroll", dismiss, true);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, [chatId, dismiss, setReference, setPositionReference]);

  const copySelection = async () => {
    const snapshot = selectionRef.current;
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot.text);
      if (selectionRef.current !== snapshot) return;
      setCopied(true);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy selected text. Try copying again.");
    }
  };

  return (
    <FloatingPortal>
      <AnimatePresence>
        {selection ? (
          <div ref={setFloating} style={floatingStyles} className="z-50">
            <motion.div
              ref={toolbarRef}
              role="toolbar"
              aria-label="Selected text actions"
              {...CHROME_FADE}
              transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
              className="flex gap-1 rounded-[var(--radius)] border border-border bg-popover p-1 text-popover-foreground shadow-md"
              onPointerDown={(event) => event.preventDefault()}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) dismiss();
              }}
            >
              <Button size="sm" variant="ghost" type="button" onClick={() => {
                onAddQuote(selection);
                window.getSelection()?.removeAllRanges();
                dismiss();
              }}>
                <MessageSquarePlus data-icon="inline-start" />Add to chat
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => { void copySelection(); }}>
                {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </FloatingPortal>
  );
}
