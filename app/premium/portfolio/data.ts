import { sampleEvents, sampleHoldings } from "./sample-data";
import type { PortfolioEvent, PortfolioHolding } from "./sample-data";

export type PortfolioData = {
  holdings: PortfolioHolding[];
  events: PortfolioEvent[];
  /** データの取得元。将来サーバ保存に切り替えたら "server" を返す。 */
  source: "sample" | "server";
};

/**
 * 保有銘柄データの取得 seam。
 *
 * 現状はリポジトリ同梱のサンプルを返すが、premium は「サーバ保存を前提」に設計する方針
 * （2026-05-31 decision-log）。将来アカウント単位のサーバ保存を導入する際は、
 * この関数の中だけをサーバ取得に差し替えれば画面側は変更不要にする。
 */
export async function loadPortfolio(): Promise<PortfolioData> {
  return {
    holdings: sampleHoldings,
    events: sampleEvents,
    source: "sample",
  };
}
