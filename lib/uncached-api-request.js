/** Never persist sensitive or live Workspace Core API GETs in PWA CacheStorage. */
function isSensitiveApiGet({ request, url }) {
  if (request.method !== "GET") return false;

  if (request.headers.has("authorization") || request.headers.has("apikey")) {
    return true;
  }

  return url?.pathname === "/api/premium/workspace-core";
}

module.exports = { isSensitiveApiGet };
