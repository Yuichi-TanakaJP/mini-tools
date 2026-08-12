// app/tools/stock-notes/data.ts
// Supabase から stock-notes のテーブルを読み取り専用で取得する。
// 書き込み（insert/update/delete）は行わない。
// - stock_notes_* は本人の行だけが RLS で見える（auth.uid() = user_id）。
// - my_stocks_items_v1（保有リスト）は既存の /api/sync（tool_data 経由）で読む。
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeItems } from "@/app/tools/my-stocks/storage";
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import type { EarningsFoldEntry, StockNotesEarningsInfo } from "./earnings-types";
import type {
  NewStockNoteInput,
  StockNoteAction,
  StockNoteAnalysis,
  StockNoteAnalysisBody,
  StockNoteCategory,
  StockNoteStock,
  StockNoteThesis,
} from "./types";

type StockRow = {
  id: string;
  code: string;
  name: string;
  category: StockNoteStock["category"];
  category_changed_at: string | null;
  category_change_reason: string | null;
  created_at: string;
  updated_at: string;
};

// body は一覧取得では絶対に select しない（最大4.5万文字・合計16万文字あるため）。
type AnalysisRow = {
  id: string;
  stock_id: string;
  analysis_type: StockNoteAnalysis["analysisType"];
  conclusion: string | null;
  evidence: string | null;
  concerns: string | null;
  source: string | null;
  source_url: string | null;
  analyzed_at: string;
  created_at: string;
};

type ThesisRow = {
  id: string;
  stock_id: string;
  view: StockNoteThesis["view"];
  confidence: StockNoteThesis["confidence"];
  thesis: unknown;
  risks: unknown;
  next_check: unknown;
  buy_more_condition: string | null;
  exit_condition: string | null;
  as_of: string;
  created_at: string;
};

type ActionRow = {
  id: string;
  stock_id: string;
  action_type: string;
  title: string;
  detail: string | null;
  trigger_condition: string | null;
  due_date: string | null;
  status: StockNoteAction["status"];
  created_at: string;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Supabase（PostgREST）から返るエラーが「セッション切れ（JWTの有効期限切れ・無効）」を
 * 示しているかどうかを判定する。
 *
 * なぜ必要か: `/api/sync` は自前のルートなので 401 を HTTP ステータスとして返せる
 * （`HoldingsFetchError`）が、`stock_notes_*` は supabase-js 経由の直読みで、
 * `.select()` のエラーは `PostgrestError`（`{message, details, hint, code}`）であり、
 * fetch の HTTP ステータスをそのまま持たない。セッションが切れているのに一般的な
 * `status: "error"` に倒すと、このダッシュボードは stale-while-revalidate で
 * キャッシュ表示を維持する設計のため、期限切れセッションの結果に基づく古い表示を
 * 延々と見せ続けてしまう（本来は /api/sync の401と同様にログイン画面へ切り替えるべき）。
 *
 * 判定方法: PostgREST は JWT の検証（RLSより前の段階）に失敗すると、行フィルタで
 * 静かに0件を返すのとは別に、リクエスト自体を拒否してエラーコード `PGRST301`
 * （"JWT expired" 等）を返す
 * （https://docs.postgrest.org/en/stable/references/errors.html#pgrst301）。
 * つまり「有効なセッションだが本人の行が無い/権限が無い」ケース（RLSが黙って
 * 0件を返す、または `42501` 等の別コード）とは明確に区別できるため、
 * 「0件」を誤って「セッション切れ」と判定することはない。
 * `code` が環境（PostgREST/PostgRESTのプロキシ経由等）によって欠落するケースへの
 * 保険として、`message` に "jwt expired" を含む場合もフォールバックで拾う。
 */
export function isSessionExpiredSupabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; message?: unknown };
  if (err.code === "PGRST301") return true;
  return typeof err.message === "string" && /jwt expired/i.test(err.message);
}

export async function fetchStocks(supabase: SupabaseClient): Promise<StockNoteStock[]> {
  const { data, error } = await supabase
    .from("stock_notes_stocks")
    .select("id, code, name, category, category_changed_at, category_change_reason, created_at, updated_at")
    .returns<StockRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    categoryChangedAt: row.category_changed_at,
    categoryChangeReason: row.category_change_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** 一覧・タイムライン用。body は含めない。 */
export async function fetchAnalyses(supabase: SupabaseClient): Promise<StockNoteAnalysis[]> {
  const { data, error } = await supabase
    .from("stock_notes_analyses")
    .select(
      "id, stock_id, analysis_type, conclusion, evidence, concerns, source, source_url, analyzed_at, created_at",
    )
    .returns<AnalysisRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    analysisType: row.analysis_type,
    conclusion: row.conclusion,
    evidence: row.evidence,
    concerns: row.concerns,
    source: row.source,
    sourceUrl: row.source_url,
    analyzedAt: row.analyzed_at,
    createdAt: row.created_at,
  }));
}

/** 会話原文（body）を明示操作時にだけ取得する。 */
export async function fetchAnalysisBody(
  supabase: SupabaseClient,
  analysisId: string,
): Promise<StockNoteAnalysisBody> {
  const { data, error } = await supabase
    .from("stock_notes_analyses")
    .select("id, body")
    .eq("id", analysisId)
    .maybeSingle<{ id: string; body: string | null }>();
  if (error) throw error;
  return { id: data?.id ?? analysisId, body: data?.body ?? null };
}

export async function fetchTheses(supabase: SupabaseClient): Promise<StockNoteThesis[]> {
  const { data, error } = await supabase
    .from("stock_notes_theses")
    .select(
      "id, stock_id, view, confidence, thesis, risks, next_check, buy_more_condition, exit_condition, as_of, created_at",
    )
    .returns<ThesisRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    view: row.view,
    confidence: row.confidence,
    thesis: toStringArray(row.thesis),
    risks: toStringArray(row.risks),
    nextCheck: toStringArray(row.next_check),
    buyMoreCondition: row.buy_more_condition,
    exitCondition: row.exit_condition,
    asOf: row.as_of,
    createdAt: row.created_at,
  }));
}

/** open のアクションだけを対象にする（アクション受信箱は未消化のみ表示するため）。 */
export async function fetchOpenActions(supabase: SupabaseClient): Promise<StockNoteAction[]> {
  const { data, error } = await supabase
    .from("stock_notes_actions")
    .select("id, stock_id, action_type, title, detail, trigger_condition, due_date, status, created_at")
    .eq("status", "open")
    .returns<ActionRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    actionType: row.action_type,
    title: row.title,
    detail: row.detail,
    triggerCondition: row.trigger_condition,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/**
 * /api/sync の取得失敗を表すエラー。
 * status を持たせ、呼び出し側で 401（未認証・セッション切れ）とそれ以外を区別できるようにする。
 * これを投げずに空配列へフォールバックすると、「保有0件」と「取得失敗」が区別できなくなり、
 * このツールの主目的（保有だが未分析の可視化）が静かに壊れるため、必ず throw する。
 */
export class HoldingsFetchError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HoldingsFetchError";
    this.status = status;
  }
}

/**
 * 保有リスト（my_stocks_items_v1）と、その最終同期日時。
 * updatedAt は /api/sync（tool_data）の updated_at。
 * これは「保有リストが最後にこの端末からクラウドへ保存された日時」であり、
 * ローカルでの編集が反映されているとは限らない（同期は手動、/account の
 * 「この端末を保存」を押した時だけアップロードされる）。
 * 詳細: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md
 */
export type HoldingsWithSync = {
  holdings: MyStockItem[];
  updatedAt: string | null;
};

/**
 * 保有リストは my-stocks の正本（tool_data の my_stocks_items_v1）を
 * 既存の /api/sync 経由で読む。my-stocks の LocalStorage は直接読まない
 * （この端末とは限らないため）。
 * 取得失敗（セッション切れ・サーバー障害など）は空配列にフォールバックせず throw する。
 */
export async function fetchHoldings(): Promise<HoldingsWithSync> {
  const res = await fetch("/api/sync", { method: "GET" });
  if (!res.ok) {
    throw new HoldingsFetchError(res.status, `保有リストの取得に失敗しました（HTTP ${res.status}）`);
  }
  const data = (await res.json()) as {
    items?: Array<{ key: string; value: unknown; updatedAt?: string }>;
  };
  const item = (data.items ?? []).find((it) => it.key === "my_stocks_items_v1");
  if (!item) return { holdings: [], updatedAt: null };
  return { holdings: normalizeItems(item.value), updatedAt: item.updatedAt ?? null };
}

/**
 * 次回決算日を /api/stock-notes/earnings（サーバールート）から取得する。
 * このルートは月次JSON（1本約500KB）をサーバー側で畳み込んでから返すため、
 * クライアントには銘柄コードごとの最小限の情報だけが届く。
 * `codes`（対象銘柄コードの一覧。保有＋分析済みの合算、通常は数十件）を渡すことで、
 * サーバー側で全銘柄（実測1,039銘柄・約140KB）ではなくこの利用者に必要な分だけへ絞り込む。
 * codes が空の場合は呼び出さない（load.ts 側で判定する）。
 * 失敗時は呼び出し側（load.ts）でキャッチし、ダッシュボード全体は失敗させず
 * 「決算情報を取得できませんでした」の表示に落とす。
 */
/**
 * fetchEarnings が受け取った `lastEarnings` を実行時に正規化する。
 *
 * なぜ必要か: `/api/stock-notes/earnings` は `Cache-Control: public, max-age=300`
 * を返している。デプロイ直後は、ブラウザ/CDN に残った「旧形式（`lastEarnings` が
 * 銘柄コード -> 日付文字列だった時代）」のレスポンスを、新しいクライアントコード
 * （`lastEarnings[code].date` を前提にしたコード）が読んでしまう経路がありうる。
 * そのまま `entry.date` を参照すると `undefined` になり、`formatMonthDay(undefined)`
 * が呼ばれて画面がクラッシュしうる。
 *
 * 方針: サーバーとクライアントのバージョンを厳密に揃える（キャッシュバスター、
 * no-cache 化）よりも、「外部から来た JSON の形をそのまま信用しない」前提で
 * クライアント側で正規化する方が副作用が少ない（他のキャッシュ済みレスポンスにも
 * 効く、サーバー側の変更が不要）。将来また `lastEarnings` の形式を変える場合も、
 * ここで吸収できるようにしておく。
 * - 値が文字列（旧形式）の場合: `{ date: <その文字列>, announcementType: "", publishStatus: "" }` に変換する
 * - 値がオブジェクトで `date` が文字列の場合: 型を軽く検証しつつそのまま使う
 * - それ以外（壊れた形）は黙って無視する（該当銘柄の前回決算は「不明」として扱われる。
 *   `lastEarningsDisplay` はキーが無ければ null を返し、行自体を出さない）
 */
export function normalizeLastEarnings(raw: unknown): Record<string, EarningsFoldEntry> {
  const result: Record<string, EarningsFoldEntry> = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      result[code] = { date: value, announcementType: "", publishStatus: "" };
      continue;
    }
    if (value && typeof value === "object" && typeof (value as { date?: unknown }).date === "string") {
      const entry = value as Partial<EarningsFoldEntry>;
      result[code] = {
        date: entry.date as string,
        announcementType: typeof entry.announcementType === "string" ? entry.announcementType : "",
        publishStatus: typeof entry.publishStatus === "string" ? entry.publishStatus : "",
      };
    }
  }
  return result;
}

export async function fetchEarnings(codes: string[]): Promise<StockNotesEarningsInfo> {
  const query = new URLSearchParams({ codes: codes.join(",") }).toString();
  const res = await fetch(`/api/stock-notes/earnings?${query}`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`決算日の取得に失敗しました（HTTP ${res.status}）`);
  }
  const raw = (await res.json()) as StockNotesEarningsInfo;
  return { ...raw, lastEarnings: normalizeLastEarnings(raw.lastEarnings) };
}

// ---------------------------------------------------------------------------
// 書き込み（stock_notes_stocks のみ）。
// - stock_notes_analyses / stock_notes_theses / stock_notes_actions への書き込みは行わない
//   （分析はGPTの領域。詳細は decision-log 参照）
// - user_id は呼び出し側（ToolClient.tsx）でログイン中のユーザーIDを必ず渡す
//   （RLSの insert ポリシーが auth.uid() = user_id のため）
// - 書き込み後の invalidateStockNotesCache 呼び出しは呼び出し側の責務（cache.ts 参照）
// - 楽観的更新はしない。呼び出し側は「書き込み→再取得」の順で行う
// ---------------------------------------------------------------------------

/**
 * Supabase（PostgREST）のエラーが「一意制約違反（重複コード）」を示しているかどうかを判定する。
 * stock_notes_stocks には unique(user_id, code) があるため、事前チェック
 * （isCodeAlreadyRegistered、logic.ts）をすり抜けた場合（他タブでの同時登録等）でも、
 * DBレベルのエラーからユーザーに分かりやすいメッセージを出せるようにする。
 * PostgreSQL の一意制約違反は SQLSTATE 23505。`code` が欠落する環境への保険として、
 * message に "duplicate key" を含む場合もフォールバックで拾う
 * （isSessionExpiredSupabaseError と同じ方針）。
 */
export function isDuplicateStockError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; message?: unknown };
  if (err.code === "23505") return true;
  return typeof err.message === "string" && /duplicate key/i.test(err.message);
}

/**
 * 新規銘柄を登録する。category_changed_at は登録時刻で初期化する
 * （「分類が変わった日」の起点を登録日にするため）。
 * 呼び出し側は登録前に isCodeAlreadyRegistered（logic.ts）で事前チェックし、
 * それでもDBの unique(user_id, code) 制約に引っかかった場合は isDuplicateStockError で判別する。
 */
export async function insertStock(
  supabase: SupabaseClient,
  userId: string,
  input: NewStockNoteInput,
): Promise<StockNoteStock> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("stock_notes_stocks")
    .insert({
      user_id: userId,
      code: input.code.trim(),
      name: input.name.trim(),
      category: input.category,
      category_changed_at: nowIso,
    })
    .select("id, code, name, category, category_changed_at, category_change_reason, created_at, updated_at")
    .single<StockRow>();
  if (error) throw error;
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    category: data.category,
    categoryChangedAt: data.category_changed_at,
    categoryChangeReason: data.category_change_reason,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * 分類を変更する（アーカイブへの変更も含む）。category_changed_at を更新時刻に更新し、
 * 任意で category_change_reason を保存する。reason が undefined の場合は列に触れず、
 * null を明示的に渡した場合は既存の理由をクリアする。
 */
export async function updateStockCategory(
  supabase: SupabaseClient,
  stockId: string,
  category: StockNoteCategory,
  reason?: string | null,
): Promise<void> {
  const update: Record<string, unknown> = {
    category,
    category_changed_at: new Date().toISOString(),
  };
  if (reason !== undefined) update.category_change_reason = reason;
  const { error } = await supabase.from("stock_notes_stocks").update(update).eq("id", stockId);
  if (error) throw error;
}

/**
 * Supabase（PostgREST）のエラーが「外部キー制約違反」を示しているかどうかを判定する。
 *
 * stock_notes_stocks -> stock_notes_analyses / stock_notes_theses の外部キーは
 * restrict（stock-notes#15 で cascade から変更済み、本番適用・実地検証済み）になっており、
 * 分析・見立てが残っている銘柄を削除しようとすると、DBが確実に削除を拒否する
 * （クライアント側の事前チェック canDeleteStock は「押す前に理由を伝える」ためのUXでしか
 * なく、正しさの担保はこのDB制約にある。詳細は logic.ts の canDeleteStock のコメント参照）。
 * このとき生のPostgRESTエラー（例: "update or delete on table \"stock_notes_stocks\"
 * violates foreign key constraint ..."）をそのまま見せず、利用者が次に何をすればよいか
 * 分かる文言（「アーカイブしてください」）に変換するために使う。
 * PostgreSQL の外部キー制約違反は SQLSTATE 23503。`code` が欠落する環境への保険として、
 * message に "foreign key constraint" を含む場合もフォールバックで拾う
 * （isDuplicateStockError / isSessionExpiredSupabaseError と同じ方針）。
 */
export function isForeignKeyViolationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; message?: unknown };
  if (err.code === "23503") return true;
  return typeof err.message === "string" && /foreign key constraint/i.test(err.message);
}

/**
 * 銘柄を削除する。呼び出し側は事前に canDeleteStock（logic.ts、分析0件のみ許可）で
 * 判定してからこの関数を呼ぶことでUX上の無駄な失敗を避けるが、それはあくまで事前案内であり、
 * 実際の安全性はDB側の外部キー制約（restrict）が担保する。分析が残っている銘柄を削除しようと
 * すると、事前チェックをすり抜けた場合（キャッシュが古い等）でもDBが 23503 を返して拒否する。
 * 呼び出し側は isForeignKeyViolationError でこれを判定し、利用者に分かりやすいメッセージを出すこと。
 */
export async function deleteStockById(supabase: SupabaseClient, stockId: string): Promise<void> {
  const { error } = await supabase.from("stock_notes_stocks").delete().eq("id", stockId);
  if (error) throw error;
}

export type BulkImportResult = {
  succeeded: string[];
  failed: { code: string; name: string; message: string; duplicate: boolean }[];
};

/**
 * マイ銘柄リストの未登録の保有銘柄を、category='holding' でまとめて登録する。
 * 1件ずつ順番に insertStock を呼び、失敗した銘柄があっても残りの登録は続行する
 * （成功分は残し、失敗分だけ個別に報告する）。
 */
export async function bulkInsertHoldingsAsStocks(
  supabase: SupabaseClient,
  userId: string,
  holdings: { code: string; name: string }[],
): Promise<BulkImportResult> {
  const succeeded: string[] = [];
  const failed: BulkImportResult["failed"] = [];
  for (const h of holdings) {
    try {
      await insertStock(supabase, userId, { code: h.code, name: h.name, category: "holding" });
      succeeded.push(h.code);
    } catch (e) {
      const duplicate = isDuplicateStockError(e);
      failed.push({
        code: h.code,
        name: h.name,
        message: duplicate ? "既に登録されています" : e instanceof Error ? e.message : String(e),
        duplicate,
      });
    }
  }
  return { succeeded, failed };
}
