/**
 * Domain barrel for `@/ai/tools`.
 * Node-only: createToolSet pulls FalkorDB; Excalidraw MCP is remote HTTP.
 * Do not import from client.
 */
export * from "./toolset";
export {
  EXCALIDRAW_MCP_URL,
  connectExcalidrawMcp,
} from "./excalidraw-mcp";
