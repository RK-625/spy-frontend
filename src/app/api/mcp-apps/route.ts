/**
 * Single MCP Apps endpoint — one route = one module universe per worker.
 *
 * GET  → `{ allowedTools }`; primes the shared client + caches on cold start.
 * POST → discriminated by body:
 *   `{ uri }`              → read an MCP App resource (cache-first, self-heals)
 *   `{ name, arguments? }` → call an app-visible MCP tool
 *
 * Because GET and POST live in the same route file, the GET's prime warms the
 * very caches the POST reads. Every path still self-heals on a cold miss.
 * Import from excalidraw-mcp directly (not the tools barrel) to avoid FalkorDB.
 */

import {
  AppVisibleToolDeniedError,
  callExcalidrawAppVisibleTool,
  ensureAppVisibleToolNames,
  getOrFetchMcpAppResource,
  isRecord,
} from "@/ai/tools/excalidraw-mcp";

export const runtime = "nodejs";

export async function GET() {
  try {
    const allowedTools = await ensureAppVisibleToolNames();
    return Response.json({ allowedTools });
  } catch (error) {
    console.error("[mcp-apps] failed to list app-visible tools:", error);
    return Response.json(
      { error: "Failed to list app-visible tools" },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json(
      { error: "Body must be a JSON object" },
      { status: 400 },
    );
  }

  // Thin dispatcher: the body shape picks the operation. The body stream can
  // only be read once and HTTP routes on method+path alone, so this single
  // exported POST must parse once and hand off to one of the two handlers.
  if (typeof body.uri === "string") {
    return handleResourceRead(body.uri);
  }
  if (typeof body.name === "string" && body.name.length > 0) {
    return handleToolCall(body.name, body.arguments);
  }

  return Response.json(
    { error: "Expected { uri } or { name, arguments } body" },
    { status: 400 },
  );
}

/** POST `{ uri }` — MCP App resource read (cache-first, self-heals on miss). */
async function handleResourceRead(uri: string): Promise<Response> {
  if (!uri.startsWith("ui://")) {
    return Response.json(
      { error: "Missing or invalid uri (expected ui://…)" },
      { status: 400 },
    );
  }
  const resource = await getOrFetchMcpAppResource(uri);
  if (!resource) {
    return Response.json(
      { error: "MCP App resource not found" },
      { status: 404 },
    );
  }
  return Response.json(resource);
}

/** POST `{ name, arguments? }` — call an app-visible MCP tool. */
async function handleToolCall(
  name: string,
  rawArguments: unknown,
): Promise<Response> {
  const toolArguments =
    rawArguments === undefined
      ? undefined
      : isRecord(rawArguments)
        ? rawArguments
        : null;
  if (toolArguments === null) {
    return Response.json(
      { error: "arguments must be an object when provided" },
      { status: 400 },
    );
  }
  try {
    const result = await callExcalidrawAppVisibleTool({
      name,
      arguments: toolArguments,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AppVisibleToolDeniedError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error("[mcp-apps] tool call failed:", name, error);
    return Response.json(
      { error: "Failed to call MCP App tool" },
      { status: 502 },
    );
  }
}