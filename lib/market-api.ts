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
 * revalidate はデータの更新頻度に合わせて呼び出し側で指定する（デフォルト 300 秒）。
 */
export async function fetchJson<T>(url: string, revalidate = 300): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
