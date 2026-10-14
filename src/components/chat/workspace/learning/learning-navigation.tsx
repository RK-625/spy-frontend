import { ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  Button,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";
import { MOTION } from "@/lib/motion";
import type { NoteLearningOutcome } from "@/lib/notes/session";

export function LearningProgress({
  processed,
  total,
}: {
  processed: number;
  total: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="shrink-0 px-6 pb-2">
      <div
        role="progressbar"
        aria-label="Notes processed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={processed}
        aria-valuetext={`${processed} of ${total} notes reviewed or skipped`}
        className="h-0.5 overflow-hidden rounded-full bg-border-subtle"
      >
        <motion.div
          className="h-full origin-left bg-text-primary"
          initial={false}
          animate={{ scaleX: processed / total }}
          transition={reduceMotion ? { duration: 0 } : MOTION.chrome}
        />
      </div>
    </div>
  );
}

export function LearningNavigation({
  firstCard,
  processed,
  total,
  onPrevious,
  onDecide,
}: {
  firstCard: boolean;
  processed: number;
  total: number;
  onPrevious: () => void;
  onDecide: (outcome: NoteLearningOutcome) => void;
}) {
  const controls = [
    {
      Icon: ChevronLeft,
      label: "Move to previous",
      action: onPrevious,
      disabled: firstCard,
    },
    {
      Icon: ChevronRight,
      label: "Skip without marking reviewed",
      action: () => onDecide("skipped"),
      disabled: false,
    },
    {
      Icon: ChevronsRight,
      label: "Mark reviewed and move to next",
      action: () => onDecide("reviewed"),
      disabled: false,
    },
  ];
  return (
    <footer className="shrink-0 px-6 pb-4">
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        <span className="font-mono text-xs text-text-secondary">
          {processed} / {total} processed
        </span>
        <TooltipProvider>
          <div
            className="flex max-w-full flex-wrap items-center gap-2"
            aria-label="Learning navigation"
          >
            {controls.map(({ Icon, label, action, disabled }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="note-control"
                    aria-label={label}
                    disabled={disabled}
                    onClick={action}
                  >
                    <Icon aria-hidden="true" strokeWidth={1.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>
    </footer>
  );
}
