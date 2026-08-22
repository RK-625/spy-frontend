/**
 * POST `{ uri }` → cached MCPAppResource JSON (filled by connectExcalidrawMcp).
 * Import from excalidraw-mcp directly (not the tools barrel) to avoid FalkorDB.
 */

import { getCachedMcpAppResource } from "@/ai/tools/excalidraw-mcp";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const uri = isRecord(body) && typeof body.uri === "string" ? body.uri : null;
  if (!uri || !uri.startsWith("ui://")) {
    return Response.json(
      { error: "Missing or invalid uri (expected ui://…)" },
      { status: 400 },
    );
  }

  const resource = getCachedMcpAppResource(uri);
  if (!resource) {
    return Response.json(
      { error: "MCP App resource not cached" },
      { status: 404 },
    );
  }

  return Response.json(resource);
}
