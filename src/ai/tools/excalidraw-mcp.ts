/**
 * Remote Excalidraw MCP connector (Node-only).
 * Schema-discovers tools from the official HTTP MCP server.
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";

export const EXCALIDRAW_MCP_URL = "https://mcp.excalidraw.com";

type ExcalidrawMcpTools = Awaited<ReturnType<MCPClient["tools"]>>;

export async function connectExcalidrawMcp(): Promise<{
  tools: ExcalidrawMcpTools;
  close: () => Promise<void>;
}> {
  const client = await createMCPClient({
    transport: {
      type: "http",
      url: EXCALIDRAW_MCP_URL,
    },
  });
  const tools = await client.tools();
  return {
    tools,
    close: () => client.close(),
  };
}
