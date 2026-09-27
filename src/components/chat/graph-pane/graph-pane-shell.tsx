"use client";

import { useEffect, useRef } from "react";
import { List } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { DotmHex9, usePrefersReducedMotion } from "@/components/dotmatrix";
import { useChatContext } from "@/contexts/ChatContext";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { CHROME_FADE, MOTION } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { GraphChangeFeed, parseGraphChanges } from "./graph-change-feed";
import { useGraphPane } from "./graph-pane-state";

export type GraphPaneState = "empty" | "loading" | "error";

type GraphPaneShellProps = {
  state?: GraphPaneState;
  errorMessage?: string;
};

const DEFAULT_ERROR_MESSAGE =
  "Something went wrong while loading the graph. Please try again.";

export const GRAPH_PANE_TRIGGER_ID = "graph-pane-trigger";

function GraphAgentMark({
  running,
  animated,
}: {
  running: boolean;
  animated: boolean;
}) {
  if (running) {
    return (
      <DotmHex9
        size={ICON_GLYPH.toolbar}
        dotSize={2.5}
        dotShape="square"
        color="currentColor"
        animated={animated}
        ariaLabel="Graph agent running"
      />
    );
  }

  return (
    <List size={ICON_GLYPH.toolbar} strokeWidth={1.5} aria-hidden />
  );
}

export function GraphPaneAgentMark() {
  const { graphJobStatus } = useChatContext();
  const reducedMotion = usePrefersReducedMotion();
  const running = graphJobStatus === "running";
  const transition = reducedMotion ? { duration: 0 } : MOTION.chrome;

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={running ? "running" : "idle"}
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
        transition={transition}
        className="flex items-center justify-center text-text-secondary"
      >
        <GraphAgentMark running={running} animated={!reducedMotion} />
      </motion.span>
    </AnimatePresence>
  );
}

function GraphPaneHeader({ className }: { className?: string }) {
  const { graphJobStatus } = useChatContext();
  const reducedMotion = usePrefersReducedMotion();
  const running = graphJobStatus === "running";
  const transition = reducedMotion ? { duration: 0 } : MOTION.chrome;

  return (
    <div
      className={cn("flex h-12 shrink-0 items-center gap-2 px-4", className)}
    >
      <h2 className="flex-1 text-sm font-medium text-text-primary">Graph</h2>
      <AnimatePresence>
        {running ? (
          <motion.span
            key="running"
            initial={reducedMotion ? { opacity: 1 } : CHROME_FADE.initial}
            animate={CHROME_FADE.animate}
            exit={reducedMotion ? { opacity: 1 } : CHROME_FADE.exit}
            transition={transition}
            className="flex items-center justify-center text-text-secondary"
          >
            <GraphAgentMark running animated={!reducedMotion} />
          </motion.span>
        ) : null}
      </AnimatePresence>
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

export function GraphPaneShell({
  state = "empty",
  errorMessage = DEFAULT_ERROR_MESSAGE,
}: GraphPaneShellProps) {
  const { open } = useGraphPane();
  const { graphMessages } = useChatContext();
  const changes = parseGraphChanges(graphMessages);
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
            {state === "error" ? (
              <GraphPaneError message={errorMessage} />
            ) : changes.length > 0 ? (
              <GraphChangeFeed changes={changes} />
            ) : state === "loading" ? (
              <GraphPaneLoading />
            ) : (
              <GraphPaneEmpty />
            )}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
