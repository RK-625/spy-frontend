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

/**
 * Lazily created, module-local shared MCP client ("create it if not present,
 * reuse it while it lives"). Each route universe owns its own singleton in
 * this Next fork; once the GET handler's prime has created it, every later
 * operation in the same universe reuses the live session (cache-warm speed).
 * `withMcpClient` replaces a stale/dead session with one reconnect.
 */
let sharedClientPromise: Promise<MCPClient> | null = null;

function getSharedClient(): Promise<MCPClient> {
  if (!sharedClientPromise) {
    sharedClientPromise = createExcalidrawMcpClient().catch((error) => {
      sharedClientPromise = null;
      throw error;
    });
  }
  return sharedClientPromise;
}

async function withMcpClient<T>(
  operation: (client: MCPClient) => Promise<T>,
): Promise<T> {
  try {
    return await operation(await getSharedClient());
  } catch {
    // Session went stale or died — drop it and retry once on a fresh one.
    sharedClientPromise = null;
    return operation(await getSharedClient());
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
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

/**
 * The single prime path used by both `connectExcalidrawMcp` and
 * `ensureAppVisibleToolNames`: records app-visible names and cache-fills every
 * declared `ui://` resource through the cache-first reader, so a cold GET
 * also warms the later POSTs.
 */
async function primeFromSplit(
  modelVisible: ListToolsResult,
  appVisible: ListToolsResult,
): Promise<void> {
  appVisibleToolNames = appVisible.tools.map((tool) => tool.name);
  for (const uri of collectUiResourceUris(modelVisible, appVisible)) {
    await getOrFetchMcpAppResource(uri);
  }
}

/**
 * Cache-first resource read with on-demand self-heal: every universe owns its
 * own cache and fills it on a cold miss; concurrent misses for the same uri
 * share one in-flight read (no fetch storms).
 */
const mcpAppResourceInFlight = new Map<
  string,
  Promise<MCPAppResource | undefined>
>();

export function getOrFetchMcpAppResource(
  uri: string,
): Promise<MCPAppResource | undefined> {
  const cached = mcpAppResourceByUri.get(uri);
  if (cached) {
    return Promise.resolve(cached);
  }
  const existing = mcpAppResourceInFlight.get(uri);
  if (existing) {
    return existing;
  }
  const pending = (async (): Promise<MCPAppResource | undefined> => {
    try {
      const resource = await withMcpClient((client) =>
        readMCPAppResource({ client, uri }),
      );
      mcpAppResourceByUri.set(uri, resource);
      return resource;
    } catch (error) {
      console.error(`[excalidraw-mcp] Failed to fetch resource ${uri}:`, error);
      return undefined;
    } finally {
      mcpAppResourceInFlight.delete(uri);
    }
  })();
  mcpAppResourceInFlight.set(uri, pending);
  return pending;
}

let appVisibleNamesInFlight: Promise<string[]> | null = null;

/**
 * Cache-first app-visible-name read with on-demand prime (same prime path as
 * connect, so a cold GET also warms the resource caches).
 */
export async function ensureAppVisibleToolNames(): Promise<string[]> {
  if (appVisibleToolNames.length > 0) {
    return appVisibleToolNames;
  }
  if (appVisibleNamesInFlight) {
    return appVisibleNamesInFlight;
  }
  const pending = (async (): Promise<string[]> => {
    try {
      await withMcpClient(async (client) => {
        const definitions = await client.listTools();
        const { modelVisible, appVisible } = splitMCPAppTools(definitions);
        await primeFromSplit(modelVisible, appVisible);
      });
      return appVisibleToolNames;
    } finally {
      appVisibleNamesInFlight = null;
    }
  })();
  appVisibleNamesInFlight = pending;
  return pending;
}

export class AppVisibleToolDeniedError extends Error {
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
  // Self-priming: a cold instance (fresh worker/HMR/prod) may have an empty
  // list because no connect ran in *this* module instance.
  const names = await ensureAppVisibleToolNames();
  if (!names.includes(name)) {
    throw new AppVisibleToolDeniedError(name);
  }

  return withMcpClient((client) =>
    client.callTool({
      name,
      arguments: toolArguments ?? {},
    }),
  );
}

export async function connectExcalidrawMcp(): Promise<{
  tools: McpTools;
  close: () => Promise<void>;
}> {
  // The MCP client is a module-owned singleton: the module manages its
  // lifecycle, so callers get a no-op close (closing it here would kill the
  // shared session for every handler in this universe).
  return withMcpClient(async (client) => {
    const definitions = await client.listTools();
    const { modelVisible, appVisible } = splitMCPAppTools(definitions);
    await primeFromSplit(modelVisible, appVisible);
    return {
      tools: client.toolsFromDefinitions(modelVisible),
      close: () => Promise.resolve(),
    };
  });
}
