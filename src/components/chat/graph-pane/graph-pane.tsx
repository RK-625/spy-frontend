"use client";

import { List } from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { GraphPaneProvider, useGraphPane } from "./graph-pane-state";
import { GraphPaneShell, type GraphPaneState } from "./graph-pane-shell";

function GraphPaneRailTrigger() {
  const { open, toggle } = useGraphPane();

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
          onClick={toggle}
          size="icon"
          type="button"
          variant="ghost"
        >
          <List
            size={ICON_GLYPH.toolbar}
            strokeWidth={1.5}
            aria-hidden
          />
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
  return (
    <GraphPaneProvider>
      <GraphPaneRailTrigger />
      <GraphPaneShell state={state} />
    </GraphPaneProvider>
  );
}
