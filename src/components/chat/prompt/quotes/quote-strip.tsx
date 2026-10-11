"use client";

import { AnimatePresence, motion } from "motion/react";
import { MessageSquareQuote, X } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import { usePromptInputContext } from "../shell/context";

export function PromptQuoteStrip() {
  const { quotes } = usePromptInputContext();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div role="group" aria-label="Quoted excerpts" className="flex min-w-0 flex-wrap gap-2 empty:hidden">
      <AnimatePresence initial={false}>
        {quotes.items.map((quote) => {
          const source = quote.sourceRole === "assistant" ? "Spy" : "You";
          return (
            <motion.div
              key={quote.id}
              layout={!reducedMotion}
              {...CHROME_FADE}
              transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
              className="flex min-w-0 max-w-full items-center gap-1 rounded-[var(--radius)] border border-border bg-muted"
            >
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="min-w-0 max-w-72 justify-start" aria-label={`Preview quote from ${source}: ${quote.text}`}>
                    <MessageSquareQuote data-icon="inline-start" />
                    <span className="shrink-0">{source}:</span>
                    <span className="truncate">{quote.text}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="top">
                  <p className="font-medium">Quote from {source}</p>
                  <blockquote className="max-h-48 overflow-auto whitespace-pre-wrap break-words">{quote.text}</blockquote>
                </PopoverContent>
              </Popover>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove quote from ${source}: ${quote.text}`} onClick={() => quotes.remove(quote.id)}>
                <X />
              </Button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
