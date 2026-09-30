/**
 * Key-writing routes run on localhost, so any web page could call them.
 * Reject browser requests from another origin. Body-carrying requests must
 * also be JSON (JSON forces a CORS preflight, which these routes never approve).
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) {
    // Non-browser local clients (curl, scripts) send no Origin.
    return true;
  }
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export function isSameOriginJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return false;
  }
  return isSameOriginRequest(request);
}
