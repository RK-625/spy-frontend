"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui";
import { useChatContext } from "@/contexts/ChatContext";

/**
 * Toast once when the graph job transitions into `failed`.
 *
 * Edge-triggered: mount/remount with an already-failed status does not refire,
 * and the StrictMode double-effect is absorbed by the prev-status ref. The
 * rail mark (not this hook) holds the failed icon until the next run.
 */
export function useGraphFailedToast(): void {
  const { graphJobStatus } = useChatContext();
  const prevStatusRef = useRef(graphJobStatus);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = graphJobStatus;
    if (graphJobStatus === "failed" && prevStatus !== "failed") {
      toast.error("Graph update failed", {
        description: "Chat is unaffected. It retries on your next message.",
      });
    }
  }, [graphJobStatus]);
}
