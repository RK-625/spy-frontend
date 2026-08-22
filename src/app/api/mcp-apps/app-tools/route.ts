/**
 * GET `{ allowedTools: string[] }` — app-visible tool names for the host bridge.
 * Import from excalidraw-mcp directly (not the tools barrel) to avoid FalkorDB.
 */

import {
  connectExcalidrawMcp,
  getAppVisibleToolNames,
} from "@/ai/tools/excalidraw-mcp";

export const runtime = "nodejs";

export async function GET() {
  let allowedTools = getAppVisibleToolNames();

  if (allowedTools.length === 0) {
    try {
      const { close } = await connectExcalidrawMcp();
      await close();
      allowedTools = getAppVisibleToolNames();
    } catch (error) {
      console.error("[mcp-apps/app-tools] connect failed:", error);
      return Response.json(
        { error: "Failed to list app-visible tools" },
        { status: 502 },
      );
    }
  }

  return Response.json({ allowedTools });
}
