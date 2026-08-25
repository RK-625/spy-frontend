/**
 * Browser helpers for experimental_MCPAppRenderer — resource load + bridge handlers.
 * Server routes proxy MCP; no MCP client in the browser.
 */

import type {
  MCPAppBridgeHandlers,
  MCPAppMetadata,
  MCPAppResource,
} from "@ai-sdk/react";

type McpAppToolCallParams = {
  name: string;
  arguments?: Record<string, unknown>;
};

let appVisibleToolsPromise: Promise<string[]> | null = null;

export async function loadMcpAppResource(
  app: MCPAppMetadata,
): Promise<MCPAppResource> {
  const response = await fetch("/api/mcp-apps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri: app.resourceUri }),
  });

  if (!response.ok) {
    throw new Error(`Failed to load MCP App resource (${response.status})`);
  }

  return (await response.json()) as MCPAppResource;
}

export function fetchAppVisibleToolNames(): Promise<string[]> {
  if (!appVisibleToolsPromise) {
    appVisibleToolsPromise = fetch("/api/mcp-apps")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load app-visible tools (${response.status})`,
          );
        }
        const body = (await response.json()) as { allowedTools: string[] };
        return body.allowedTools;
      })
      .catch((error: unknown) => {
        appVisibleToolsPromise = null;
        throw error;
      });
  }
  return appVisibleToolsPromise;
}

async function callMcpAppVisibleTool(
  params: McpAppToolCallParams,
): Promise<unknown> {
  const response = await fetch("/api/mcp-apps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`MCP App tools/call failed (${response.status})`);
  }

  return response.json();
}

function openMcpAppLink({ url }: { url: string }): Record<string, never> {
  window.open(url, "_blank", "noopener,noreferrer");
  return {};
}

export function createMcpAppBridgeHandlers(
  allowedTools: string[],
): MCPAppBridgeHandlers {
  return {
    allowedTools,
    callTool: callMcpAppVisibleTool,
    openLink: openMcpAppLink,
  };
}
