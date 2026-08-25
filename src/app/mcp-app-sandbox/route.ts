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

  // Host-derived CSP lists app-declared domains only under connect/img/font-src,
  // but MCP Apps (e.g. Excalidraw) bundle via <script type="importmap"> module
  // imports from those same domains. Promote declared http(s) origins into
  // script-src/style-src too, or the app's module graph dies and the frame
  // renders blank.
  function promoteDeclaredOrigins(csp) {
    if (typeof csp !== "string" || csp.length === 0) {
      return csp;
    }
    var directives = csp
      .split(";")
      .map(function (d) { return d.trim(); })
      .filter(function (d) { return d.length > 0; });
    // NOTE: doubled backslashes — this script lives inside a TS template
    // literal, so a single "\s" would be emitted as "s" and the regex would
    // silently match the wrong thing (blank-frame bug).
    var origins = [];
    directives.forEach(function (d) {
      var parts = d.split(/\\s+/);
      var name = parts[0];
      if (
        name === "connect-src" ||
        name === "img-src" ||
        name === "font-src"
      ) {
        parts.slice(1).forEach(function (v) {
          if (/^https?:\\/\\/\\S+$/i.test(v) && origins.indexOf(v) === -1) {
            origins.push(v);
          }
        });
      }
    });
    if (origins.length === 0) {
      return csp;
    }
    return directives
      .map(function (d) {
        var name = d.split(/\\s+/)[0];
        if (name === "script-src" || name === "style-src") {
          return d + " " + origins.join(" ");
        }
        return d;
      })
      .join("; ");
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
          inner.srcdoc = injectCspMeta(
            params.html,
            promoteDeclaredOrigins(params.csp),
          );
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
