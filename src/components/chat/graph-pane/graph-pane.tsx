"use client";

import { useEffect, useRef } from "react";
import { Button, Tooltip, TooltipContent, TooltipTrigger, toast } from "@/components/ui";
import { useChatContext } from "@/contexts/ChatContext";
import { GraphPaneProvider, useGraphPane } from "./state/graph-pane-state";
import {
  GraphPaneAgentMark,
  GraphPaneShell,
  GRAPH_PANE_TRIGGER_ID,
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

export function GraphPane() {
  const { chatId, graphJobStatus } = useChatContext();
  const previousStatusRef = useRef(graphJobStatus);
  const previousChatIdRef = useRef(chatId);

  // Toast only after this same chat was running and then failed. Restoring
  // an older failed chat on switch is a different chat id, so it stays quiet.
  // The rail mark still shows that saved failure.
  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const sameChat = previousChatIdRef.current === chatId;
    previousStatusRef.current = graphJobStatus;
    previousChatIdRef.current = chatId;
    if (sameChat && previousStatus === "running" && graphJobStatus === "failed") {
      toast.error("Graph update failed", {
        description: "Chat is unaffected. It retries on your next message.",
      });
    }
  }, [chatId, graphJobStatus]);

  return (
    <GraphPaneProvider>
      <GraphPaneRailTrigger />
      <GraphPaneShell />
    </GraphPaneProvider>
  );
}
