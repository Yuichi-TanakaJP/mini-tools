/** @type {import('next').NextConfig} */

const defaultRuntimeCaching = require("next-pwa/cache");
const { isSensitiveApiGet } = require("./lib/uncached-api-request");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: isSensitiveApiGet,
      handler: "NetworkOnly",
      method: "GET",
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.origin) return false;
        return (
          url.pathname === "/tools/yutai-dashboard" ||
          url.pathname.startsWith("/tools/yutai-dashboard/") ||
          url.pathname === "/premium/login" ||
          url.pathname === "/api/stock-notes/audience" ||
          url.pathname === "/api/yutai/stock-prices" ||
          url.pathname.startsWith("/api/yutai/stock-prices/") ||
          url.pathname === "/api/yutai/launch-display" ||
          url.pathname.startsWith("/api/yutai/launch-display/")
        );
      },
      handler: "NetworkOnly",
      method: "GET",
    },
    ...defaultRuntimeCaching,
  ],
});

const nextConfig = {
  // Read and write screens switch together; individual preview flags remain for isolated UAT.
  env: {
    // Fail closed when Vercel's deployment type is unavailable or is Preview.
    EDINET_IDENTITY_UAT_DEPLOY_ENV: process.env.VERCEL_ENV === "production" ? "production" : "blocked",
    ...(process.env.NEXT_PUBLIC_YUTAI_DB_CANONICAL === "true" ? {
    NEXT_PUBLIC_YUTAI_CANDIDATES_DB_PREVIEW: "true",
    NEXT_PUBLIC_YUTAI_MEMO_DB_PREVIEW: "true",
    NEXT_PUBLIC_YUTAI_DASHBOARD_DB_PREVIEW: "true",
    NEXT_PUBLIC_YUTAI_EXPIRY_DB_PREVIEW: "true",
    NEXT_PUBLIC_YUTAI_TRANSFER_DB_PREVIEW: "true",
    NEXT_PUBLIC_YUTAI_RESTORE_DB_PREVIEW: "true",
    } : {}),
  },
  reactStrictMode: true,
  async redirects() {
    return [
      {
        // ルーティン一覧は premium 配下へ移動した。旧 URL のブックマークを拾う。
        source: "/tools/routines",
        destination: "/premium/routines",
        permanent: true,
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
