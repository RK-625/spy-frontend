"use client";

/**
 * Host chrome for MCP App tool views.
 * Renders Card chrome + experimental_MCPAppRenderer (no AppBridge).
 */

import { useEffect, useMemo, useState } from "react";
import type { DynamicToolUIPart } from "ai";
import {
  experimental_MCPAppRenderer as MCPAppRenderer,
  type MCPAppSandboxConfig,
} from "@ai-sdk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Excalidraw } from "@/components/logos";
import {
  createMcpAppBridgeHandlers,
  fetchAppVisibleToolNames,
  loadMcpAppResource,
} from "./mcp-app-host";

const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
const IFRAME_MAX_HEIGHT = "min(80dvh, 56rem)";
const IFRAME_MAX_WIDTH = "100%";
const mcpAppSandbox = {
  url: "/mcp-app-sandbox",
  allowedPermissions: ["clipboardWrite"],
} satisfies MCPAppSandboxConfig;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when the tool part carries valid MCP App metadata for the renderer. */
export function hasMcpAppView(part: DynamicToolUIPart): boolean {
  const app = part.toolMetadata?.app;
  return (
    isRecord(app) &&
    typeof app.resourceUri === "string" &&
    app.resourceUri.startsWith("ui://") &&
    app.mimeType === MCP_APP_MIME_TYPE
  );
}

const loadingFallback = (
  <div className="text-sm text-[var(--text-secondary)] px-3 py-8">
    Loading MCP App…
  </div>
);

export function MCPAppCard({ part }: { part: DynamicToolUIPart }) {
  const [allowedTools, setAllowedTools] = useState<string[] | null>(null);
  const [iframeHeightPx, setIframeHeightPx] = useState(0);
  const [iframeWidthPx, setIframeWidthPx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchAppVisibleToolNames()
      .then((names) => {
        if (!cancelled) {
          setAllowedTools(names);
        }
      })
      .catch((error: unknown) => {
        console.error("[MCPAppCard] app-tools fetch failed:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlers = useMemo(
    () =>
      allowedTools == null
        ? undefined
        : {
          ...createMcpAppBridgeHandlers(allowedTools),
          onSizeChange: ({
            width,
            height,
          }: {
            width?: number;
            height?: number;
          }) => {
            if (typeof height === "number" && height > 0) {
              setIframeHeightPx(height);
            }
            if (typeof width === "number" && width > 0) {
              setIframeWidthPx(width);
            }
          },
        },
    [allowedTools],
  );

  const sandbox = useMemo(
    () => ({
      ...mcpAppSandbox,
      style: {
        display: "block",
        border: 0,
        width: iframeWidthPx,
        height: iframeHeightPx,
        maxWidth: IFRAME_MAX_WIDTH,
        maxHeight: IFRAME_MAX_HEIGHT,
      },
    }),
    [iframeHeightPx, iframeWidthPx],
  );

  return (
    <Card
      size="sm"
      className="my-3 w-full overflow-hidden rounded-[var(--radius)] bg-[var(--card)] ring-1 ring-[var(--border)]"
    >
      <CardHeader className="flex flex-row items-center gap-2 border-b border-[var(--border)] py-2">
        <Excalidraw className="size-4 shrink-0" aria-hidden />
        <CardTitle className="text-sm font-medium text-[var(--lavender)]">
          {part.toolName}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {handlers == null ? (
          loadingFallback
        ) : (
          <MCPAppRenderer
            part={part}
            sandbox={sandbox}
            loadResource={loadMcpAppResource}
            handlers={handlers}
            hostInfo={{ name: "Spy", version: "0.1.0" }}
            hostContext={{ theme: "dark", displayMode: "inline" }}
            fallback={loadingFallback}
          />
        )}
      </CardContent>
    </Card>
  );
}
