/**
 * POST `{ name, arguments }` → MCP tool result for app-visible tools only.
 * Import from excalidraw-mcp directly (not the tools barrel) to avoid FalkorDB.
 */

import {
  AppVisibleToolDeniedError,
  callExcalidrawAppVisibleTool,
} from "@/ai/tools/excalidraw-mcp";

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

  if (!isRecord(body) || typeof body.name !== "string" || body.name.length === 0) {
    return Response.json({ error: "Missing tool name" }, { status: 400 });
  }

  const toolArguments =
    body.arguments === undefined
      ? undefined
      : isRecord(body.arguments)
        ? body.arguments
        : null;
  if (toolArguments === null) {
    return Response.json(
      { error: "arguments must be an object when provided" },
      { status: 400 },
    );
  }

  try {
    const result = await callExcalidrawAppVisibleTool({
      name: body.name,
      arguments: toolArguments,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AppVisibleToolDeniedError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error("[mcp-apps/call-tool] failed:", body.name, error);
    return Response.json(
      { error: "Failed to call MCP App tool" },
      { status: 502 },
    );
  }
}
