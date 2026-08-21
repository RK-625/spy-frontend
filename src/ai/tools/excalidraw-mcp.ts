/**
 * Remote Excalidraw MCP connector (Node-only).
 * Schema-discovers tools from the official HTTP MCP server and caches
 * MCP App HTML resources (`ui://`) for host iframe serving.
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";

export const EXCALIDRAW_MCP_URL = "https://mcp.excalidraw.com";

type McpTools = Awaited<ReturnType<MCPClient["tools"]>>;

type McpAppHtmlCacheEntry = {
  html: string;
  mimeType: string;
};

/** HTML text keyed by `ui://` resource URI. */
const mcpAppHtmlByUri = new Map<string, McpAppHtmlCacheEntry>();

/** Tool name → `ui://` URI discovered from tool `_meta`. */
const mcpAppUriByToolName = new Map<string, string>();

/** Cache MCP App HTML for tools that advertise a `ui://` resource URI. */
async function cacheMcpAppHtml(
  client: MCPClient,
  tools: McpTools,
): Promise<void> {
  for (const [toolName, tool] of Object.entries(tools)) {
    const uri = getToolUiResourceUri({ _meta: tool._meta });
    if (!uri) {
      continue;
    }
    if (mcpAppHtmlByUri.has(uri)) {
      mcpAppUriByToolName.set(toolName, uri);
      continue;
    }
    try {
      const resource = await client.readResource({ uri });
      const htmlContent = resource.contents.find(
        (content): content is Extract<typeof content, { text: string }> =>
          typeof content.text === "string",
      );
      if (!htmlContent) {
        continue;
      }
      mcpAppHtmlByUri.set(uri, {
        html: htmlContent.text,
        mimeType: htmlContent.mimeType ?? "text/html",
      });
      mcpAppUriByToolName.set(toolName, uri);
    } catch (error) {
      console.error(
        "[excalidraw-mcp] readResource failed:",
        toolName,
        uri,
        error,
      );
    }
  }
}

export function getCachedMcpAppHtmlByUri(
  uri: string,
): McpAppHtmlCacheEntry | undefined {
  return mcpAppHtmlByUri.get(uri);
}

export function getMcpAppUriByToolName(toolName: string): string | undefined {
  return mcpAppUriByToolName.get(toolName);
}

export async function connectExcalidrawMcp(): Promise<{
  tools: McpTools;
  close: () => Promise<void>;
}> {
  const client = await createMCPClient({
    transport: {
      type: "http",
      url: EXCALIDRAW_MCP_URL,
    },
  });
  const tools = await client.tools();
  await cacheMcpAppHtml(client, tools);
  return {
    tools,
    close: () => client.close(),
  };
}
