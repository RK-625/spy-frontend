"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/components/dotmatrix";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useGraphPane } from "./graph-pane-state";

export type GraphPaneState = "empty" | "loading" | "error";

type GraphPaneShellProps = {
  state?: GraphPaneState;
  errorMessage?: string;
};

const DEFAULT_ERROR_MESSAGE =
  "Something went wrong while loading the graph. Please try again.";

function GraphPaneHeader({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex h-12 shrink-0 items-center gap-2 px-4", className)}
    >
      <h2 className="flex-1 text-sm font-medium text-text-primary">Graph</h2>
    </div>
  );
}

function GraphPaneEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm text-text-secondary">No graph yet</p>
    </div>
  );
}

const LOADING_SKELETON_ROWS = [0, 1, 2];

function GraphPaneLoading() {
  return (
    <div
      className="flex flex-col gap-3 px-4 py-4"
      role="status"
      aria-label="Loading graph"
    >
      {LOADING_SKELETON_ROWS.map((row) => (
        <div
          key={row}
          aria-hidden
          className="h-16 animate-pulse rounded-[var(--radius)] bg-[var(--surface-subtle)]"
        />
      ))}
    </div>
  );
}

function GraphPaneError({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium text-text-primary">
        Couldn&apos;t load the graph
      </p>
      <p className="max-w-xs text-sm text-text-secondary">{message}</p>
    </div>
  );
}

export const GRAPH_PANE_TRIGGER_ID = "graph-pane-trigger";

export function GraphPaneShell({
  state = "empty",
  errorMessage = DEFAULT_ERROR_MESSAGE,
}: GraphPaneShellProps) {
  const { open } = useGraphPane();
  const reducedMotion = usePrefersReducedMotion();
  const transition = reducedMotion ? { duration: 0 } : MOTION.chrome;
  const panelRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(open);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open && !wasOpen) {
      panelRef.current?.focus({ preventScroll: true });
    } else if (!open && wasOpen) {
      document
        .getElementById(GRAPH_PANE_TRIGGER_ID)
        ?.focus({ preventScroll: true });
    }
  }, [open]);

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          ref={panelRef}
          role="complementary"
          aria-label="Graph"
          data-graph-pane
          tabIndex={-1}
          className="absolute inset-y-0 right-0 z-30 flex w-[360px] flex-col border-l border-[var(--border-default)] bg-[var(--surface-chat-panel)]/80 backdrop-blur-md"
          initial={
            reducedMotion
              ? CHROME_FADE.initial
              : { ...CHROME_FADE.initial, x: 32 }
          }
          animate={
            reducedMotion
              ? CHROME_FADE.animate
              : { ...CHROME_FADE.animate, x: 0 }
          }
          exit={
            reducedMotion ? CHROME_FADE.exit : { ...CHROME_FADE.exit, x: 32 }
          }
          transition={transition}
        >
          <GraphPaneHeader />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {state === "loading" ? (
              <GraphPaneLoading />
            ) : state === "error" ? (
              <GraphPaneError message={errorMessage} />
            ) : (
              <GraphPaneEmpty />
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
