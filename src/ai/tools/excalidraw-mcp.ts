/**
 * Remote Excalidraw MCP connector (Node-only).
 * Discovers model-visible tools, caches MCP App `ui://` resources, and
 * proxies app-visible tool calls for the browser host.
 */

import {
  createMCPClient,
  mcpAppClientCapabilities,
  splitMCPAppTools,
  readMCPAppResource,
  type MCPClient,
  type MCPAppResource,
  type ListToolsResult,
} from "@ai-sdk/mcp";

export const EXCALIDRAW_MCP_URL = "https://mcp.excalidraw.com/mcp";

type McpTools = ReturnType<MCPClient["toolsFromDefinitions"]>;

/** Cached MCP App resources keyed by `ui://` URI. */
const mcpAppResourceByUri = new Map<string, MCPAppResource>();

/** App-visible tool names from the last successful connect. */
let appVisibleToolNames: string[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectUiResourceUris(...definitionLists: ListToolsResult[]): string[] {
  const uris = new Set<string>();
  for (const definitions of definitionLists) {
    for (const tool of definitions.tools) {
      const ui = tool._meta?.ui;
      const uri =
        isRecord(ui) && typeof ui.resourceUri === "string"
          ? ui.resourceUri
          : undefined;
      if (uri?.startsWith("ui://")) {
        uris.add(uri);
      }
    }
  }
  return [...uris];
}

async function cacheUiResources(
  client: MCPClient,
  uris: string[],
): Promise<void> {
  for (const uri of uris) {
    if (mcpAppResourceByUri.has(uri)) {
      continue;
    }
    const resource = await readMCPAppResource({ client, uri });
    mcpAppResourceByUri.set(uri, resource);
  }
}

async function createExcalidrawMcpClient(): Promise<MCPClient> {
  return createMCPClient({
    transport: {
      type: "http",
      url: EXCALIDRAW_MCP_URL,
    },
    clientName: "spy-mcp-apps-host",
    capabilities: mcpAppClientCapabilities,
  });
}

export function getCachedMcpAppResource(
  uri: string,
): MCPAppResource | undefined {
  return mcpAppResourceByUri.get(uri);
}

export function getAppVisibleToolNames(): string[] {
  return appVisibleToolNames;
}

export class AppVisibleToolDeniedError extends Error {
  readonly statusCode = 403;

  constructor(toolName: string) {
    super(`Tool is not app-visible: ${toolName}`);
    this.name = "AppVisibleToolDeniedError";
  }
}

export async function callExcalidrawAppVisibleTool({
  name,
  arguments: toolArguments,
}: {
  name: string;
  arguments?: Record<string, unknown>;
}): Promise<unknown> {
  if (!appVisibleToolNames.includes(name)) {
    throw new AppVisibleToolDeniedError(name);
  }

  const client = await createExcalidrawMcpClient();
  try {
    return await client.callTool({
      name,
      arguments: toolArguments ?? {},
    });
  } finally {
    await client.close();
  }
}

export async function connectExcalidrawMcp(): Promise<{
  tools: McpTools;
  close: () => Promise<void>;
}> {
  const client = await createExcalidrawMcpClient();
  try {
    const definitions = await client.listTools();
    const { modelVisible, appVisible } = splitMCPAppTools(definitions);
    const tools = client.toolsFromDefinitions(modelVisible);

    appVisibleToolNames = appVisible.tools.map((tool) => tool.name);

    const uris = collectUiResourceUris(modelVisible, appVisible);
    await cacheUiResources(client, uris);

    return {
      tools,
      close: () => client.close(),
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
