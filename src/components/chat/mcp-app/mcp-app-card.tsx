"use client";

/**
 * Host chrome for MCP App tool views.
 * Renders Card chrome + experimental_MCPAppRenderer.
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

const mcpAppSandbox: MCPAppSandboxConfig = {
  url: "/mcp-app-sandbox",
  allowedPermissions: ["clipboardWrite"],
};

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
  const [iframeHeightPx, setIframeHeightPx] = useState<number | null>(null);

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
            onSizeChange: ({ height }: { height?: number }) => {
              if (typeof height === "number" && height > 0) {
                setIframeHeightPx(height);
              }
            },
          },
    [allowedTools],
  );

  const sandbox = useMemo<MCPAppSandboxConfig>(
    () => ({
      ...mcpAppSandbox,
      style: {
        display: "block",
        border: 0,
        width: "100%",
        height: iframeHeightPx ?? 0,
        transition: "height 0.25s ease",
      },
    }),
    [iframeHeightPx],
  );

  return (
    <Card
      size="sm"
      className="my-3 w-full overflow-hidden rounded-[var(--radius)] bg-[var(--card)] ring-1 ring-[var(--border)] [&]:gap-0 [&]:py-0"
    >
      <CardHeader className="flex flex-row items-center gap-2 border-b border-[var(--border)] py-2 [--card-spacing:--spacing(2)]">
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
