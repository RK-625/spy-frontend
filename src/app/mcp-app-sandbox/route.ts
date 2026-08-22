/**
 * Same-origin MCP Apps sandbox proxy (Route Handler — not a page).
 * Outer iframe loads this HTML; host posts sandbox-resource-ready with HTML
 * for an inner srcdoc iframe (no allow-same-origin on the inner frame).
 */

export const runtime = "nodejs";

const SANDBOX_PROXY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MCP App Sandbox</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
    }
    #mcp-app-inner {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: transparent;
    }
  </style>
</head>
<body>
  <iframe id="mcp-app-inner" title="MCP App"></iframe>
  <script>
(function () {
  if (window.self === window.top) {
    document.body.textContent = "MCP App sandbox must run inside an iframe.";
    return;
  }

  var parentOrigin;
  try {
    parentOrigin = document.referrer
      ? new URL(document.referrer).origin
      : window.location.origin;
  } catch (e) {
    parentOrigin = window.location.origin;
  }

  var inner = document.getElementById("mcp-app-inner");
  if (!inner) {
    return;
  }

  function injectCspMeta(html, csp) {
    if (typeof csp !== "string" || csp.length === 0) {
      return html;
    }
    var meta =
      '<meta http-equiv="Content-Security-Policy" content="' +
      csp.replace(/"/g, "&quot;") +
      '" />';
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head[^>]*>/i, function (match) {
        return match + meta;
      });
    }
    return meta + html;
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.jsonrpc !== "2.0") {
      return;
    }

    if (event.source === window.parent) {
      if (event.origin !== parentOrigin) {
        return;
      }
      if (data.method === "ui/notifications/sandbox-resource-ready") {
        var params = data.params || {};
        if (typeof params.sandbox === "string") {
          inner.setAttribute("sandbox", params.sandbox);
        }
        if (typeof params.allow === "string") {
          inner.setAttribute("allow", params.allow);
        }
        if (typeof params.html === "string") {
          inner.srcdoc = injectCspMeta(params.html, params.csp);
        }
        return;
      }
      if (inner.contentWindow) {
        inner.contentWindow.postMessage(data, "*");
      }
      return;
    }

    if (event.source === inner.contentWindow) {
      window.parent.postMessage(data, parentOrigin);
    }
  });

  window.parent.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/sandbox-proxy-ready",
      params: {},
    },
    parentOrigin
  );
})();
  </script>
</body>
</html>`;

export async function GET() {
  return new Response(SANDBOX_PROXY_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
