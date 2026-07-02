// workers/dynamic-sites/src/index.js
const DEFAULT_FILE = "index.html";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Example URL patterns supported:
    // 1) /<userId>/<siteSlug>/path
    // 2) /<userId>/<siteSlug>/
    // 3) custom domain routing can be added by parsing hostname

    let key = url.pathname.replace(/^\/+/, ""); // remove leading slash

    // If empty or ends with slash, serve index.html
    if (!key || key.endsWith("/")) {
      key = (key ? key : "") + DEFAULT_FILE;
    }

    // Try to fetch object from R2 bucket binding SITES_BUCKET
    // Keys in R2 are stored as: userId/siteSlug/path
    const obj = await env.SITES_BUCKET.get(key);

    if (!obj) {
      // Try fallback: if request was to a directory without trailing slash, try index.html
      if (!key.endsWith(DEFAULT_FILE)) {
        const alt = key.replace(/\/?$/, "/") + DEFAULT_FILE;
        const altObj = await env.SITES_BUCKET.get(alt);
        if (altObj) {
          return new Response(altObj.body, {
            headers: {
              "Content-Type": altObj.httpMetadata?.contentType || "text/html",
              "Cache-Control": "public, max-age=5"
            }
          });
        }
      }
      return new Response("Not found", { status: 404 });
    }

    const contentType = obj.httpMetadata?.contentType || guessContentType(key);

    return new Response(obj.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheHeader(key)
      }
    });
  }
};

function guessContentType(key) {
  if (key.endsWith(".html")) return "text/html; charset=utf-8";
  if (key.endsWith(".css")) return "text/css; charset=utf-8";
  if (key.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".svg")) return "image/svg+xml";
  if (key.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function cacheHeader(key) {
  if (key.endsWith(".html")) return "public, max-age=5";
  if (key.endsWith(".css") || key.endsWith(".js")) return "public, max-age=3600";
  return "public, max-age=86400";
}
