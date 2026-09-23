/** Never persist authenticated API GETs in the PWA's cross-origin CacheStorage. */
function isSensitiveApiGet({ request }) {
  return request.method === "GET"
    && (request.headers.has("authorization") || request.headers.has("apikey"));
}

module.exports = { isSensitiveApiGet };
