/**
 * Key-writing routes run on localhost, so any web page could POST to them.
 * Reject browser requests from another origin and non-JSON bodies (JSON
 * forces a CORS preflight, which these routes never approve).
 */
export function isSameOriginJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return false;
  }
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
