// app/tools/stock-notes/logic.ts
// 画面の外側で独立してテストできる純関数群（window / Supabase 非依存）。
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import type { EarningsFoldEntry, StockNotesEarningsInfo } from "./earnings-types";
import type {
  StockNoteAction,
  StockNoteAnalysis,
  StockNoteCategory,
  StockNoteStock,
  StockNoteThesis,
} from "./types";

/**
 * 鮮度バッジの閾値（日数）。
 * stock-notes の分析頻度は決算・ニュース起点で不定期（月〜数ヶ月に1回程度）のため、
 * 90日（≒四半期決算1回分）を「そろそろ確認」、180日（≒半年、決算2回分）を「要更新」の目安にする。
 * 根拠: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md
 */
export const FRESHNESS_WARN_DAYS = 90;
export const FRESHNESS_DANGER_DAYS = 180;

export type FreshnessLevel = "fresh" | "warn" | "danger" | "unknown";

/** 最終分析日からの経過で鮮度レベルを判定する。分析が無ければ "unknown"。 */
export function freshnessLevel(
  lastAnalyzedAt: string | null | undefined,
  now: Date = new Date(),
): FreshnessLevel {
  if (!lastAnalyzedAt) return "unknown";
  const last = new Date(lastAnalyzedAt).getTime();
  if (!Number.isFinite(last)) return "unknown";
  const days = (now.getTime() - last) / (1000 * 60 * 60 * 24);
  if (days < 0) return "fresh"; // 未来日付（時計ズレ等）は安全側で fresh 扱い
  if (days > FRESHNESS_DANGER_DAYS) return "danger";
  if (days > FRESHNESS_WARN_DAYS) return "warn";
  return "fresh";
}

/**
 * 鮮度判定を「決算またぎ」基準に拡張したバージョン。
 * 最終分析日より後に決算発表があった銘柄は、経過日数に関係なく
 * "post-earnings"（要更新・決算後未分析）にする。これがこのツールの本来の警告。
 * 決算日が判明していない場合は、従来どおり経過日数（90日/180日）だけで判定する。
 * 詳細: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md
 */
export type FreshnessLevelV2 = FreshnessLevel | "post-earnings";

/**
 * @param lastAnalyzedAt 最終分析日（ISO文字列）
 * @param lastEarningsDate 直近の過去の決算日（YYYY-MM-DD）。判明していなければ null
 * @param now 現在時刻（テスト用に注入可能）
 */
export function freshnessLevelWithEarnings(
  lastAnalyzedAt: string | null | undefined,
  lastEarningsDate: string | null | undefined,
  now: Date = new Date(),
): FreshnessLevelV2 {
  const dayLevel = freshnessLevel(lastAnalyzedAt, now);
  if (!lastAnalyzedAt || !lastEarningsDate) return dayLevel;

  const lastAnalyzed = new Date(lastAnalyzedAt).getTime();
  if (!Number.isFinite(lastAnalyzed)) return dayLevel;

  // 決算日は日付のみ（YYYY-MM-DD）。当日23:59:59 JST相当までを「その日の決算」とみなし、
  // 分析日時と比較する。タイムゾーンの厳密な扱いより「またいだかどうか」の判定を優先する。
  // 注意: ここは +09:00（JST）でなければならない。Z（UTC）にすると、カットオフが
  // 実際より9時間遅く（決算日の翌朝08:59:59 JST）ずれるため、決算日の翌朝9時より前に
  // 行った分析（＝実際には決算後の分析）まで誤って post-earnings 扱いになってしまう
  // （例: 8/5決算、8/6 00:00 JST の分析は決算後なので post-earnings ではないはずだが、
  //  UTC基準のカットオフ 8/6 08:59:59 JST より前のため誤検知していた）。
  const earnings = new Date(`${lastEarningsDate}T23:59:59.999+09:00`).getTime();
  if (!Number.isFinite(earnings)) return dayLevel;

  if (earnings > lastAnalyzed) return "post-earnings";
  return dayLevel;
}

export type UnanalyzedHolding = {
  code: string;
  name: string;
  quantity: number | null;
};

/**
 * 保有銘柄（my-stocks の tab='holding'）のうち、
 * stock_notes_stocks に存在しない、または分析が0件の銘柄を抽出する。
 * 同一銘柄が複数口座で保有されている場合は1件に集約する。
 */
export function computeUnanalyzedHoldings(
  holdings: MyStockItem[],
  stocks: StockNoteStock[],
  analyses: StockNoteAnalysis[],
): UnanalyzedHolding[] {
  const stockByCode = new Map(stocks.map((s) => [s.code, s]));
  const analysisCountByStockId = new Map<string, number>();
  for (const a of analyses) {
    analysisCountByStockId.set(a.stockId, (analysisCountByStockId.get(a.stockId) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const result: UnanalyzedHolding[] = [];
  for (const h of holdings) {
    if (h.tab !== "holding") continue;
    if (seen.has(h.code)) continue;
    seen.add(h.code);
    const stock = stockByCode.get(h.code);
    const hasAnalysis = stock ? (analysisCountByStockId.get(stock.id) ?? 0) > 0 : false;
    if (!stock || !hasAnalysis) {
      result.push({ code: h.code, name: h.name, quantity: h.quantity ?? null });
    }
  }
  return result.sort((a, b) => a.code.localeCompare(b.code));
}

/** ChatGPT カスタムGPTへ貼るための短い分析プロンプト文を組み立てる。 */
export function buildAnalysisPrompt(code: string, name: string): string {
  return `${code} ${name}について、直近の決算と現在の投資判断を整理して`;
}

/**
 * 銘柄の「現在の見立て」を1件選ぶ。
 * created_at ではなく as_of の降順（同値なら created_at の降順）で選ぶ。
 * 過去の分析を当時の日付で as_of に入れて取り込んでいるため、登録順(created_at)では最新にならない。
 */
export function selectLatestThesis(
  theses: StockNoteThesis[],
  stockId: string,
): StockNoteThesis | null {
  const target = theses.filter((t) => t.stockId === stockId);
  if (target.length === 0) return null;
  return target.reduce((latest, cur) => {
    const latestAsOf = new Date(latest.asOf).getTime();
    const curAsOf = new Date(cur.asOf).getTime();
    if (curAsOf !== latestAsOf) return curAsOf > latestAsOf ? cur : latest;
    return new Date(cur.createdAt).getTime() > new Date(latest.createdAt).getTime() ? cur : latest;
  });
}

/** 指定銘柄の分析一覧（新しい順）。 */
export function analysesForStock(
  analyses: StockNoteAnalysis[],
  stockId: string,
): StockNoteAnalysis[] {
  return analyses
    .filter((a) => a.stockId === stockId)
    .slice()
    .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
}

/** 指定銘柄の最終分析日（analyzed_at の最大値）。分析が無ければ null。 */
export function latestAnalyzedAt(analyses: StockNoteAnalysis[], stockId: string): string | null {
  const target = analysesForStock(analyses, stockId);
  return target.length > 0 ? target[0].analyzedAt : null;
}

export function analysisCountForStock(analyses: StockNoteAnalysis[], stockId: string): number {
  return analyses.reduce((count, a) => (a.stockId === stockId ? count + 1 : count), 0);
}

export function openActionCountForStock(actions: StockNoteAction[], stockId: string): number {
  return actions.reduce(
    (count, a) => (a.stockId === stockId && a.status === "open" ? count + 1 : count),
    0,
  );
}

/** アクション受信箱の並び順: 期限（due_date）昇順。期限未設定は末尾（作成日昇順）。 */
export function sortOpenActions(actions: StockNoteAction[]): StockNoteAction[] {
  return actions
    .filter((a) => a.status === "open")
    .slice()
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
}

export function isOverdue(dueDate: string | null, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate).getTime();
  return Number.isFinite(due) && due < now.getTime();
}

/**
 * 未分析の保有銘柄を「決算が近い順」に並べ替える。
 * 決算日が判明している銘柄を先頭に日付昇順、判明していない銘柄はその後ろにコード順で並べる。
 * @param earningsByCode 銘柄コード -> 次回決算日（YYYY-MM-DD）。判明していない銘柄はキーが無い。
 */
export function sortUnanalyzedHoldingsByEarnings(
  holdings: UnanalyzedHolding[],
  earningsByCode: Record<string, { date: string }>,
): UnanalyzedHolding[] {
  return holdings.slice().sort((a, b) => {
    const dateA = earningsByCode[a.code]?.date ?? null;
    const dateB = earningsByCode[b.code]?.date ?? null;
    if (dateA && dateB) {
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      return a.code.localeCompare(b.code);
    }
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    return a.code.localeCompare(b.code);
  });
}

/**
 * 決算までの残り日数（当日は0、過去日ならマイナス値）。日付のみで計算し、時刻・タイムゾーンの誤差は無視する。
 * dateStr が不正（壊れた外部JSON等で "YYYY-MM-DD" として解釈できない）な場合は null を返す。
 * 呼び出し側はこれを見て「NaN日前」のような表示をしないよう、日数表示自体を省く。
 */
export function daysUntil(dateStr: string, now: Date = new Date()): number | null {
  const target = new Date(`${dateStr}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(target)) return null;
  const nowJstMidnight = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now) + "T00:00:00+09:00",
  ).getTime();
  return Math.round((target - nowJstMidnight) / (1000 * 60 * 60 * 24));
}

/** 決算が3日以内（当日〜3日後）に迫っている銘柄かどうか。強調表示の判定に使う。不正な日付は false。 */
export function isEarningsSoon(dateStr: string, now: Date = new Date()): boolean {
  const days = daysUntil(dateStr, now);
  return days !== null && days >= 0 && days <= 3;
}

/**
 * 過去の決算日からの経過日数（当日は0、必ず0以上）。「前回決算 8/4（7日前）」の表示に使う。
 * daysUntil は未来日を正・過去日を負で返すため符号を反転する。dateStr に未来日を渡した場合
 * （データ不整合等）は安全側で0に丸める。JSTでの日付境界の扱いは daysUntil に委譲する。
 * dateStr が不正な場合は null を返す（呼び出し側は「N日前」の表示を省く）。
 */
export function daysSinceEarnings(dateStr: string, now: Date = new Date()): number | null {
  const days = daysUntil(dateStr, now);
  return days === null ? null : Math.max(0, -days);
}

/**
 * "YYYY-MM-DD" を "M/D" に変換する（表示用）。外部JSON由来のため形式を検証し、
 * 不正な場合は日付を捏造せず "(日付不明)" にフォールバックする。
 */
export function formatMonthDay(dateStr: string | null | undefined): string {
  const match = typeof dateStr === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr) : null;
  if (!match) return "(日付不明)";
  return `${Number(match[2])}/${Number(match[3])}`;
}

export type EarningsDisplay = { text: string; soon: boolean; failed: boolean };

/**
 * 次回決算の表示テキストを組み立てる。
 * - earnings が null（取得自体に失敗）: 「決算情報を取得できませんでした」
 * - 予定が見つかった: 「次回決算 8/14（あと3日）」
 * - 予定が見つからず、かつ取得が完全（`complete`）だった: 「次回決算 未判明（カレンダーは9/30まで）」
 *   （「予定なし」とは書かない。カレンダーが約2ヶ月先までしか無いため）
 * - 予定が見つからず、かつ一部の月の取得に失敗していた（`complete: false`）: 未判明とは断定できない
 *   （欠落した月にその銘柄の決算が入っていた可能性があるため）ので「取得できませんでした」側に倒す
 */
export function earningsDisplay(
  code: string,
  earnings: StockNotesEarningsInfo | null,
  now: Date = new Date(),
): EarningsDisplay {
  if (earnings === null) {
    return { text: "決算情報を取得できませんでした", soon: false, failed: true };
  }
  const entry = earnings.earnings[code];
  if (entry) {
    const days = daysUntil(entry.date, now);
    const daysText = days === null ? "" : days === 0 ? "本日" : days > 0 ? `あと${days}日` : `${Math.abs(days)}日前`;
    return {
      text: `次回決算 ${formatMonthDay(entry.date)}${daysText ? `（${daysText}）` : ""}`,
      soon: isEarningsSoon(entry.date, now),
      failed: false,
    };
  }
  if (!earnings.complete) {
    return { text: "決算情報を取得できませんでした（一部期間が未取得）", soon: false, failed: true };
  }
  const windowText = earnings.windowTo ? `${formatMonthDay(earnings.windowTo)}まで` : "約2ヶ月先まで";
  return { text: `次回決算 未判明（カレンダーは${windowText}）`, soon: false, failed: false };
}

/**
 * 前回決算（過ぎてしまった決算）の表示テキストを組み立てる。
 * - lastEarnings にキーが無ければ null（呼び出し側は行自体を出さない。「不明」と書き足しても
 *   情報量が無いのに行が増えるだけのため）
 * - 次回決算が判明している場合は経過日数を付けない（次回情報が主役なので、前回は補助情報でよい）:
 *   「前回決算 8/4（1Q）」
 * - 次回決算が未判明の場合は前回決算が唯一の手がかりになるため、経過日数を付けて目立たせる:
 *   「前回決算 8/4（1Q・7日前）」
 * - `earnings.complete === false`（一部の月の取得に失敗）の場合、この lastEarnings は本来より
 *   新しい決算を見落としている可能性がある（例: 7月分の取得に失敗し6月分は成功していると、
 *   実際には7月に決算があるのに「前回決算 6月」と表示されてしまう）。この場合は「一部期間が
 *   未取得のため不確実」という注記を添える。決算またぎ警告（freshnessLevelWithEarnings）自体は
 *   抑制しない。抑制すると、欠落が無ければ検出できていたはずの「決算またぎ」の警告まで消えてしまい、
 *   既存データで判定できる範囲の情報量を失う（false negative の方が false positive より実害が大きい
 *   と判断した）。詳細: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md
 */
export function lastEarningsDisplay(
  code: string,
  earnings: StockNotesEarningsInfo | null,
  emphasize: boolean,
  now: Date = new Date(),
): string | null {
  const entry = earnings?.lastEarnings[code];
  if (!entry) return null;
  const parts: string[] = [];
  if (entry.announcementType) parts.push(entry.announcementType);
  if (emphasize) {
    const days = daysSinceEarnings(entry.date, now);
    if (days !== null) parts.push(days === 0 ? "本日" : `${days}日前`);
  }
  if (earnings?.complete === false) parts.push("一部期間が未取得のため不確実");
  const suffix = parts.length > 0 ? `（${parts.join("・")}）` : "";
  return `前回決算 ${formatMonthDay(entry.date)}${suffix}`;
}

/**
 * 保有リストの同期状態。
 * - fresh: SYNC_STALE_DAYS 未満
 * - stale: SYNC_STALE_DAYS 以上
 * - unknown: 同期日時が無い、または不正な値（一度も同期していない等）。
 *   「stale」と混同すると「30日以上前」という誤った具体的な経過を伝えてしまうため区別する。
 */
export type SyncStaleness = "fresh" | "stale" | "unknown";

/** 保有リスト（/api/sync）の同期が30日以上前かどうか。 */
export const SYNC_STALE_DAYS = 30;

export function syncStaleness(updatedAt: string | null | undefined, now: Date = new Date()): SyncStaleness {
  if (!updatedAt) return "unknown";
  const updated = new Date(updatedAt).getTime();
  if (!Number.isFinite(updated)) return "unknown";
  const days = (now.getTime() - updated) / (1000 * 60 * 60 * 24);
  return days >= SYNC_STALE_DAYS ? "stale" : "fresh";
}

/** 保有リストの同期からの経過日数（表示用、0未満は0に丸める）。 */
export function daysSinceSync(updatedAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!updatedAt) return null;
  const updated = new Date(updatedAt).getTime();
  if (!Number.isFinite(updated)) return null;
  const days = Math.floor((now.getTime() - updated) / (1000 * 60 * 60 * 24));
  return Math.max(days, 0);
}

/** tab='holding' の件数。空状態の判定に使う（ウォッチのみ登録時に「保有はすべて分析済み」と誤表示しないため）。 */
export function countHoldingTabItems(holdings: MyStockItem[]): number {
  return holdings.reduce((count, h) => (h.tab === "holding" ? count + 1 : count), 0);
}

/**
 * Record からキーで値を引くとき、キーが存在しなければ既定値にフォールバックする。
 *
 * なぜ必要か: `view` / `confidence` / `analysisType` のような値は TypeScript の型定義上は
 * 閉じた union（例: `"bullish" | "neutral" | "bearish"`）だが、これは実行時には保証されない。
 * 値の出どころは Supabase からの直読み（DBスキーマ変更・手動編集等で想定外の値が入りうる）と
 * localStorage キャッシュ（cache.ts は構造レベルの検証のみで、個々の値までは検証しない）の
 * 2系統あり、どちらも「型が保証しない実行時の値」を運んでくる可能性がある。
 * `VIEW_COLORS[thesis.view]` のように union をキーにした Record への直接アクセスは、
 * 想定外の値が来ると `undefined` を返し、その先で `.bg` 等を参照してクラッシュする。
 * この関数を経由することで、想定外の値でも既定値にフォールバックして描画を継続できる。
 */
export function withFallback<T>(record: Record<string, T>, key: string, fallback: T): T {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : fallback;
}

/**
 * ISO文字列を「HH:MM」（JST）表示に変換する。キャッシュの「最終更新」表示と、
 * 再取得失敗時の案内文の両方で使う。不正な値・未設定は null（呼び出し側は時刻部分を省く）。
 */
export function formatClockTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * stale-while-revalidate のバックグラウンド再取得（自動・手動どちらも）が失敗したときの案内文。
 * 表示中のキャッシュ/前回取得データは消さずに維持する前提で、「これは何時時点の表示か」を伝える。
 * fetchedAt が無い/不正な場合は時刻を省いた文言にフォールバックする。
 */
export function buildRevalidateFailureMessage(fetchedAt: string | null | undefined): string {
  const time = formatClockTime(fetchedAt);
  return time ? `最新の取得に失敗しました（表示は${time}時点）。` : "最新の取得に失敗しました。";
}

/**
 * 非同期取得の「世代（generation）」を管理する。
 * ユーザー切替やログアウトが連続したとき、古いリクエストの結果が新しい画面を
 * 上書きしないようにするためのガード。React に依存しない純粋なユーティリティ。
 *
 * 使い方: 取得を開始する直前に next() でトークンを取得し、取得完了時に
 * isCurrent(token) が true のときだけ setState する。false なら結果を破棄する。
 * ログアウトなど「進行中の取得を無効化したいが新しい取得は開始しない」場合は invalidate() を呼ぶ。
 */
export function createLoadGuard() {
  let token = 0;
  return {
    next(): number {
      token += 1;
      return token;
    },
    isCurrent(candidate: number): boolean {
      return candidate === token;
    },
    invalidate(): void {
      token += 1;
    },
  };
}

export type LoadGuard = ReturnType<typeof createLoadGuard>;

// ---------------------------------------------------------------------------
// 5タブ構成（要対応 / 保有 / ウォッチ / 新規調査 / アーカイブ）・登録・分類変更・削除・
// 一括取り込みのための純関数群。
// 「書き込み可」への方針変更の経緯・タブ構成の意図は decision-log を参照。
// ---------------------------------------------------------------------------

export type StockNotesTab = "action-required" | StockNoteCategory;

export const STOCK_NOTES_TABS: readonly StockNotesTab[] = [
  "action-required",
  "holding",
  "watch",
  "research",
  "archived",
];

/**
 * 未消化アクションの期限が「間近」とみなす日数。0（当日）〜この日数以内、または
 * 既に期限切れなら「要対応」に含める。
 */
export const ACTION_DUE_SOON_DAYS = 7;

/** 指定銘柄の open アクションのうち、期限切れ・期限間近（ACTION_DUE_SOON_DAYS以内）のものがあるか。 */
export function hasUrgentOpenAction(stockActions: StockNoteAction[], now: Date = new Date()): boolean {
  return stockActions.some((a) => {
    if (a.status !== "open" || !a.dueDate) return false;
    const due = new Date(a.dueDate).getTime();
    if (!Number.isFinite(due)) return false;
    const days = (due - now.getTime()) / (1000 * 60 * 60 * 24);
    return days <= ACTION_DUE_SOON_DAYS;
  });
}

/**
 * 「要対応」タブの対象銘柄を判定する。アーカイブは対象外。
 * 次のいずれかに該当する銘柄を対象にする:
 * - 分析0件
 * - 最終分析日より後に決算があった（決算またぎ、freshnessLevelWithEarnings が post-earnings）
 * - 期限切れ・期限間近（ACTION_DUE_SOON_DAYS以内）の未消化アクションがある
 */
export function computeActionRequiredStocks(
  stocks: StockNoteStock[],
  analyses: StockNoteAnalysis[],
  actions: StockNoteAction[],
  lastEarningsByCode: Record<string, EarningsFoldEntry>,
  now: Date = new Date(),
): StockNoteStock[] {
  return stocks.filter((s) => {
    if (s.category === "archived") return false;
    const count = analysisCountForStock(analyses, s.id);
    if (count === 0) return true;
    const lastAnalyzed = latestAnalyzedAt(analyses, s.id);
    const lastEarningsDate = lastEarningsByCode[s.code]?.date ?? null;
    if (freshnessLevelWithEarnings(lastAnalyzed, lastEarningsDate, now) === "post-earnings") return true;
    const stockActions = actions.filter((a) => a.stockId === s.id);
    return hasUrgentOpenAction(stockActions, now);
  });
}

/** 最終分析日の古い順（未分析=nullが最上位）に並べる比較関数。 */
function compareLastAnalyzedAsc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return new Date(a).getTime() - new Date(b).getTime();
}

/** 「要対応」タブの並び順: 次回決算日が近い順（未判明は後ろ）→最終分析日の古い順。 */
export function sortActionRequiredStocks(
  stocks: StockNoteStock[],
  analyses: StockNoteAnalysis[],
  nextEarningsByCode: Record<string, EarningsFoldEntry>,
): StockNoteStock[] {
  return stocks.slice().sort((a, b) => {
    const dateA = nextEarningsByCode[a.code]?.date ?? null;
    const dateB = nextEarningsByCode[b.code]?.date ?? null;
    if (dateA && dateB && dateA !== dateB) return dateA < dateB ? -1 : 1;
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    return compareLastAnalyzedAsc(latestAnalyzedAt(analyses, a.id), latestAnalyzedAt(analyses, b.id));
  });
}

/** 「保有／ウォッチ／新規調査／アーカイブ」タブの並び順: 最終分析日の古い順（未分析が最上位）。 */
export function sortStocksByLastAnalyzedAsc(
  stocks: StockNoteStock[],
  analyses: StockNoteAnalysis[],
): StockNoteStock[] {
  return stocks
    .slice()
    .sort((a, b) => compareLastAnalyzedAsc(latestAnalyzedAt(analyses, a.id), latestAnalyzedAt(analyses, b.id)));
}

/**
 * タブごとの表示対象・並び順をまとめて返す（ToolClient.tsx から呼ぶ入口）。
 * 「要対応」はアーカイブを除く全カテゴリを横断して判定するため、他のタブとは別ロジックになる。
 */
export function stocksForTab(
  tab: StockNotesTab,
  stocks: StockNoteStock[],
  analyses: StockNoteAnalysis[],
  actions: StockNoteAction[],
  earnings: StockNotesEarningsInfo | null,
  now: Date = new Date(),
): StockNoteStock[] {
  if (tab === "action-required") {
    const required = computeActionRequiredStocks(stocks, analyses, actions, earnings?.lastEarnings ?? {}, now);
    return sortActionRequiredStocks(required, analyses, earnings?.earnings ?? {});
  }
  const filtered = stocks.filter((s) => s.category === tab);
  return sortStocksByLastAnalyzedAsc(filtered, analyses);
}

/** タブごとの件数（ラベルの「要対応 15」のような表示に使う）。 */
export function countStocksForTab(
  tab: StockNotesTab,
  stocks: StockNoteStock[],
  analyses: StockNoteAnalysis[],
  actions: StockNoteAction[],
  earnings: StockNotesEarningsInfo | null,
  now: Date = new Date(),
): number {
  return stocksForTab(tab, stocks, analyses, actions, earnings, now).length;
}

export type UnregisteredHolding = { code: string; name: string; quantity: number | null };

/**
 * マイ銘柄リストの保有銘柄（tab='holding'）のうち、stock_notes_stocks に未登録のものを抽出する。
 * 一括取り込みバナー（「マイ銘柄リストに未登録の保有が N 件あります」）の対象を求めるために使う。
 * computeUnanalyzedHoldings（分析0件も含む・銘柄登録の有無を問わない）とは異なり、
 * こちらは「stock_notes_stocks に行そのものが無い」ものだけを対象にする。
 */
export function extractUnregisteredHoldings(
  holdings: MyStockItem[],
  stocks: StockNoteStock[],
): UnregisteredHolding[] {
  const registeredCodes = new Set(stocks.map((s) => s.code));
  const seen = new Set<string>();
  const result: UnregisteredHolding[] = [];
  for (const h of holdings) {
    if (h.tab !== "holding") continue;
    if (registeredCodes.has(h.code) || seen.has(h.code)) continue;
    seen.add(h.code);
    result.push({ code: h.code, name: h.name, quantity: h.quantity ?? null });
  }
  return result.sort((a, b) => a.code.localeCompare(b.code));
}

/** 既に登録済みの証券コードかどうか（登録フォームの事前チェック用）。 */
export function isCodeAlreadyRegistered(stocks: StockNoteStock[], code: string): boolean {
  const normalized = code.trim();
  if (!normalized) return false;
  return stocks.some((s) => s.code === normalized);
}

/**
 * 新規登録フォームの入力検証（クライアント側の事前チェック）。
 * エラーが無ければ null、あればエラーメッセージ文字列を返す。
 * 重複コードのチェックは呼び出し側で isCodeAlreadyRegistered と組み合わせて行う
 * （stocks 一覧を都度渡すより関心を分離した方がテストしやすいため）。
 */
export function validateNewStockInput(code: string, name: string): string | null {
  if (!code.trim()) return "証券コードを入力してください。";
  if (!name.trim()) return "銘柄名を入力してください（マスターに無い場合は手入力してください）。";
  return null;
}

/**
 * 分析が1件でもある銘柄は削除させない（on delete cascade で分析・見立て・アクションが
 * 全部消えるため）。削除できるのは分析0件の銘柄だけ。アーカイブが基本、削除は例外という
 * 位置づけの根拠。詳細は decision-log 参照。
 */
export function canDeleteStock(stock: StockNoteStock, analyses: StockNoteAnalysis[]): boolean {
  return analysisCountForStock(analyses, stock.id) === 0;
}

/** 削除できない理由の説明文（UIでの無効化理由の表示に使う）。 */
export function deleteBlockedReason(stock: StockNoteStock, analyses: StockNoteAnalysis[]): string | null {
  const count = analysisCountForStock(analyses, stock.id);
  if (count === 0) return null;
  return `分析${count}件が連鎖削除されるため削除できません。アーカイブしてください。`;
}
