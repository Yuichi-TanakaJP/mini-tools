// app/tools/my-stocks/types.ts

/** 保有メモ / ウォッチ の2タブ */
export type StockListTab = "holding" | "watch";

/** jpx_listed_companies.json の1レコード（銘柄マスタ） */
export type StockMaster = {
  code: string;
  name: string;
  market: string;
  sector: string | null;
};

/**
 * localStorage に保存する1銘柄。
 * 保有/ウォッチ共通。保有固有の項目（数量・取得単価）は任意。
 * 銘柄名・市場・業種は追加時点のマスタ値をスナップショットして持つ
 * （マスタ更新で表示が消えないようにするため）。
 */
export type MyStockItem = {
  id: string;
  code: string;
  name: string;
  market: string;
  sector: string | null;
  tab: StockListTab;
  /** 保有メモのみ。手入力。評価額・損益は出さない方針のため取得単価のみ。 */
  quantity?: number | null;
  acquisitionPrice?: number | null;
  memo?: string;
  addedAt: number;
  updatedAt: number;
};

/**
 * server 側で「広めに取得」した公開データから作る code→情報の対応表。
 * クライアントはこの表をユーザーの保有/ウォッチ銘柄コードで filter して
 * バッジ表示する（銘柄コード集合をサーバへ送らないための設計）。
 */
export type MyStocksReference = {
  /** 基準日（参考表示用）。取得できなければ null。 */
  asOf: string | null;
  /** code → 直近の決算予定日（ISO: YYYY-MM-DD）。 */
  nextEarningsByCode: Record<string, string>;
  /** code → 優待権利確定月（1-12、複数あり得る）。 */
  yutaiMonthsByCode: Record<string, number[]>;
};
