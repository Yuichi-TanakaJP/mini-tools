/** @type {import('next').NextConfig} */

const defaultRuntimeCaching = require("next-pwa/cache");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.origin) return false;
        return (
          url.pathname === "/tools/yutai-dashboard" ||
          url.pathname.startsWith("/tools/yutai-dashboard/") ||
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
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
