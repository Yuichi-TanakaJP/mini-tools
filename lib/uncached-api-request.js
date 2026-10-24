/** Never persist sensitive or live Workspace Core API GETs in PWA CacheStorage. */
function isSensitiveApiGet({ request, url }) {
  if (request.method !== "GET") return false;

  if (request.headers.has("authorization") || request.headers.has("apikey")) {
    return true;
  }

  const pathname = url?.pathname.replace(/\/+$/, "");
  if (["/tools/stock-ranking", "/tools/topix33", "/tools/nikkei-contribution", "/tools/investor-flow"].some(path => pathname === path || pathname?.startsWith(`${path}/`))) return true;
  return pathname === "/api/premium/workspace-core" ||
    pathname === "/api/premium/themes/text";
}

module.exports = { isSensitiveApiGet };
