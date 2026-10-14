"use client";

import { AnimatePresence, motion } from "motion/react";
import { MessageSquareQuote, X } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import { usePromptInputContext } from "../shell/context";
import { formatQuotePreview } from "./quote-state";

/** Compact quote chips: one-line rendered preview; source and full excerpt live in the popover. */
export function PromptQuoteStrip() {
  const { quotes } = usePromptInputContext();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div role="group" aria-label="Quoted excerpts" className="flex min-w-0 flex-wrap gap-1.5 px-prompt-body-x pt-prompt-body-y empty:hidden">
      <AnimatePresence initial={false}>
        {quotes.items.map((quote) => {
          const source = quote.sourceRole === "assistant" ? "Spy" : "You";
          const preview = formatQuotePreview(quote);
          return (
            <motion.div
              key={quote.id}
              layout={!reducedMotion}
              {...CHROME_FADE}
              transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
              className="group/quote flex h-6 min-w-0 max-w-full items-center rounded-[var(--radius)] border border-border bg-muted text-xs"
            >
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="xs" className="min-w-0 max-w-48 justify-start pr-0.5 text-xs font-normal" aria-label={`Preview quote from ${source}: ${preview}`}>
                    <MessageSquareQuote data-icon="inline-start" className="text-muted-foreground" />
                    <span className="truncate">{preview}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="top">
                  <p className="font-medium">Quote from {source}</p>
                  <blockquote className="max-h-48 overflow-auto whitespace-pre-wrap break-words">{quote.plainText}</blockquote>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-5 opacity-60 transition-opacity duration-[var(--duration-fast)] group-hover/quote:opacity-100 focus-visible:opacity-100 [&>svg]:size-3"
                aria-label={`Remove quote from ${source}: ${preview}`}
                onClick={() => quotes.remove(quote.id)}
              >
                <X />
              </Button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
