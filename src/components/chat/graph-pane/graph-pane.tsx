"use client";

import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { GraphPaneProvider, useGraphPane } from "./state/graph-pane-state";
import { useGraphFailedToast } from "./state/use-graph-failed-toast";
import {
  GraphPaneAgentMark,
  GraphPaneShell,
  GRAPH_PANE_TRIGGER_ID,
  type GraphPaneState,
} from "./shell/graph-pane-shell";

function GraphPaneRailTrigger() {
  const { open, toggleGraphPane } = useGraphPane();

  if (open) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-expanded={open}
          aria-label="Open graph pane"
          className="absolute top-4 right-4 z-30 text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground"
          id={GRAPH_PANE_TRIGGER_ID}
          onClick={toggleGraphPane}
          size="icon"
          type="button"
          variant="ghost"
        >
          <GraphPaneAgentMark />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Open graph pane</TooltipContent>
    </Tooltip>
  );
}

type GraphPaneProps = {
  state?: GraphPaneState;
};

export function GraphPane({ state }: GraphPaneProps) {
  // Always mounted (unlike the rail trigger), so no failed transition is missed.
  useGraphFailedToast();

  return (
    <GraphPaneProvider>
      <GraphPaneRailTrigger />
      <GraphPaneShell state={state} />
    </GraphPaneProvider>
  );
}
