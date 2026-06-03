// app/tools/yutai-memo/data-loader.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { canUseLocalMarketDataFallback, getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { NikkoShortBalanceData } from "./types";

const EMPTY: NikkoShortBalanceData = { asOf: null, byCode: {} };

async function loadLocalSample(): Promise<NikkoShortBalanceData | null> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "app/tools/yutai-memo/data/nikko_short_balance_sample.json"),
      "utf-8",
    );
    return JSON.parse(raw) as NikkoShortBalanceData;
  } catch {
    return null;
  }
}

/**
 * 日興の信用売り残高（株数）の公開 JSON を取得する。
 * market-info は「登録された銘柄コードだけ」を取得して by_code に載せる
 * （全銘柄取得は行わない）。ユーザーの保有銘柄コードはここでは使わず、
 * クライアントが自分のコードで filter して表示する。
 *
 * API 未設定時はサンプルにフォールバック（開発用）。
 * API あり・fetch 失敗時はサンプルを返さず空表にする（誤情報防止）。
 */
export async function loadNikkoShortBalance(): Promise<NikkoShortBalanceData> {
  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return (canUseLocalMarketDataFallback() ? await loadLocalSample() : null) ?? EMPTY;
  }

  try {
    // 反映は「いつか反映される」型なので頻繁な再取得は不要。60 秒キャッシュ。
    return await fetchJson<NikkoShortBalanceData>(`${apiBase}/nikko/short-balance`, 60);
  } catch {
    return EMPTY;
  }
}
