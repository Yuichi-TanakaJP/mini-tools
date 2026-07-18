const DEFAULT_PREMIUM_NEXT_PATH = "/premium";
const ALLOWED_PREMIUM_NEXT_PATHS = [
  "/premium",
  "/admin",
  "/tools/yutai-dashboard",
] as const;

function isAllowedPathname(pathname: string) {
  return ALLOWED_PREMIUM_NEXT_PATHS.some(
    (allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
  );
}

export function getSafePremiumNextPath(rawNextPath: string | null | undefined) {
  if (!rawNextPath) return DEFAULT_PREMIUM_NEXT_PATH;
  if (
    rawNextPath.includes("\\") ||
    rawNextPath.includes("\r") ||
    rawNextPath.includes("\n")
  ) {
    return DEFAULT_PREMIUM_NEXT_PATH;
  }

  try {
    const baseUrl = "https://mini-tools.local";
    const normalizedUrl = new URL(rawNextPath, baseUrl);

    if (normalizedUrl.origin !== baseUrl || !isAllowedPathname(normalizedUrl.pathname)) {
      return DEFAULT_PREMIUM_NEXT_PATH;
    }

    return `${normalizedUrl.pathname}${normalizedUrl.search}${normalizedUrl.hash}`;
  } catch {
    return DEFAULT_PREMIUM_NEXT_PATH;
  }
}

export function getYutaiDashboardPath(month: string | null | undefined) {
  if (!month) return "/tools/yutai-dashboard";
  return `/tools/yutai-dashboard?${new URLSearchParams({ month })}`;
}
