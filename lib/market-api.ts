/**
 * market-info API のベース URL を返す。
 * MARKET_INFO_API_BASE_URL が未設定の場合は空文字列を返し、
 * 各 data-loader 側で fetch をスキップする判定に使う。
 */
export function getApiBaseUrl(): string {
  return process.env.MARKET_INFO_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
}

/**
 * JSON を fetch して型付きで返す。5秒タイムアウト付き。
 * Next.js の revalidate キャッシュ（300秒）を使う。
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
