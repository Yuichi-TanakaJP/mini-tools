"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import TabBar from "@/app/tools/_shared/TabBar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSyncConfigured } from "@/lib/supabase/config";
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import {
  bulkInsertHoldingsAsStocks,
  deleteStockById,
  fetchAnalysisBody,
  fetchAnalyses,
  fetchEarnings,
  fetchHoldings,
  fetchOpenActions,
  fetchStockNotesDelta,
  fetchStocks,
  fetchTheses,
  insertStock,
  isDuplicateStockError,
  isForeignKeyViolationError,
  updateStockCategory,
  type BulkImportResult,
} from "./data";
import type { StockNotesEarningsInfo } from "./earnings-types";
import { invalidateStockNotesCache, readStockNotesCache, writeStockNotesCache } from "./cache";
import type { StockNotesManifest } from "./delta";
import { loadDashboardData, type DashboardData } from "./load";
import { useStockNotesStockMaster } from "./useStockNotesStockMaster";
import {
  actionRequiredReasons,
  analysesForStock,
  analysisCountForStock,
  buildAnalysisPrompt,
  buildRevalidateFailureMessage,
  canDeleteStock,
  countStocksForTab,
  createLoadGuard,
  daysSinceSync,
  deleteBlockedReason,
  earningsDisplay,
  extractUnregisteredHoldings,
  formatClockTime,
  formatMonthDay,
  freshnessLevelWithEarnings,
  isCodeAlreadyRegistered,
  isOverdue,
  lastEarningsDisplay,
  latestAnalyzedAt,
  openActionCountForStock,
  selectLatestThesis,
  shouldRefetchAfterBulkImport,
  sortOpenActions,
  stocksForTab,
  STOCK_NOTES_TABS,
  SYNC_STALE_DAYS,
  syncStaleness,
  validateNewStockInput,
  withFallback,
  type ActionRequiredReason,
  type FreshnessLevelV2,
  type StockNotesTab,
  type SyncStaleness,
  type UnregisteredHolding,
} from "./logic";
import type {
  StockNoteAction,
  StockNoteAnalysis,
  StockNoteCategory,
  StockNoteStock,
  StockNoteThesis,
} from "./types";

type LoadState = "idle" | "loading" | "loaded" | "unauthorized" | "error";

const CATEGORY_LABELS: Record<StockNoteCategory, string> = {
  holding: "保有",
  watch: "ウォッチ",
  research: "新規調査",
  archived: "アーカイブ",
};
const CATEGORY_SELECT_OPTIONS: StockNoteCategory[] = ["holding", "watch", "research", "archived"];

/** 5タブ（要対応/保有/ウォッチ/新規調査/アーカイブ）のベースラベル。件数は都度付与する。 */
const TAB_BASE_LABELS: Record<StockNotesTab, string> = {
  "action-required": "要対応",
  holding: CATEGORY_LABELS.holding,
  watch: CATEGORY_LABELS.watch,
  research: CATEGORY_LABELS.research,
  archived: CATEGORY_LABELS.archived,
};

const VIEW_LABELS: Record<StockNoteThesis["view"], string> = {
  bullish: "強気",
  neutral: "中立",
  bearish: "弱気",
};
const VIEW_COLORS: Record<StockNoteThesis["view"], { bg: string; fg: string }> = {
  bullish: { bg: "rgba(22,163,74,0.14)", fg: "#16a34a" },
  neutral: { bg: "var(--color-bg-input)", fg: "var(--color-text-sub)" },
  bearish: { bg: "rgba(220,38,38,0.14)", fg: "#dc2626" },
};
const CONFIDENCE_LABELS: Record<StockNoteThesis["confidence"], string> = {
  high: "確信度高",
  medium: "確信度中",
  low: "確信度低",
};
const ANALYSIS_TYPE_LABELS: Record<StockNoteAnalysis["analysisType"], string> = {
  earnings: "決算",
  financial: "財務",
  initial: "初回",
  news: "ニュース",
  other: "その他",
};
const FRESHNESS_COLORS: Record<FreshnessLevelV2, { bg: string; fg: string; label: string } | null> = {
  fresh: null,
  unknown: null,
  warn: { bg: "rgba(217,119,6,0.14)", fg: "#d97706", label: "そろそろ確認" },
  danger: { bg: "rgba(220,38,38,0.14)", fg: "#dc2626", label: "要更新" },
  // label はフォールバック（lastEarningsDate が取れないケース用）。通常は FreshnessBadge が
  // 「8/4の決算後、未分析」のように日付入りの文言を動的に組み立てる（decision-log参照:
  // 日付が入ることで、利用者が何を確認すべきか即座に分かるようにするため）。
  "post-earnings": { bg: "rgba(220,38,38,0.14)", fg: "#dc2626", label: "要更新（決算後未分析）" },
};

const dangerText: React.CSSProperties = {
  fontSize: 12,
  color: "var(--color-danger, #dc2626)",
  fontWeight: 700,
};

// formatMonthDay / earningsDisplay / lastEarningsDisplay は純関数として
// app/tools/stock-notes/logic.ts に切り出し、そちらでユニットテストしている
// （React に依存しないロジックはコンポーネント外に置く方針。詳細は decision-log 参照）。

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  borderRadius: 14,
  border: "1px solid var(--color-border)",
  padding: "14px 14px 12px",
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 10,
  background: "var(--color-accent)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
const subBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 10,
  background: "var(--color-bg-input)",
  color: "var(--color-text-sub)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const badgeStyle = (bg: string, fg: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: bg,
  color: fg,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: "nowrap",
});
const emptyText: React.CSSProperties = {
  fontSize: 13,
  color: "var(--color-text-muted)",
  padding: "14px 4px",
  margin: 0,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "var(--color-text)",
  margin: 0,
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
}

const EMPTY_DASHBOARD_DATA: DashboardData = {
  stocks: [],
  analyses: [],
  theses: [],
  actions: [],
  holdings: [],
  holdingsUpdatedAt: null,
  earnings: null,
};

export default function ToolClient() {
  const configured = isSyncConfigured();
  const [supabase] = useState<SupabaseClient | null>(() =>
    configured ? createSupabaseBrowserClient() : null,
  );

  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [stocks, setStocks] = useState<StockNoteStock[]>([]);
  const [analyses, setAnalyses] = useState<StockNoteAnalysis[]>([]);
  const [theses, setTheses] = useState<StockNoteThesis[]>([]);
  const [actions, setActions] = useState<StockNoteAction[]>([]);
  const [holdings, setHoldings] = useState<MyStockItem[]>([]);
  const [holdingsUpdatedAt, setHoldingsUpdatedAt] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<StockNotesEarningsInfo | null>(null);

  // stale-while-revalidate 用の表示状態。
  // dataUpdatedAt: 現在画面に出ているデータ（キャッシュ or 直近取得）の取得時刻（ISO）。
  //   「最終更新 HH:MM」表示と、再取得失敗時の案内文の両方に使う。
  // isRevalidating: バックグラウンド再取得（マウント時の自動 or 手動更新ボタン）が進行中かどうか。
  // revalidateError: バックグラウンド再取得が失敗したときの案内文。表示中のデータは消さない。
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [revalidateError, setRevalidateError] = useState<string | null>(null);

  const [categoryTab, setCategoryTab] = useState<StockNotesTab>("action-required");
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string | "loading" | "error">>({});

  // 銘柄の登録・分類変更・アーカイブ・削除・一括取り込み（書き込み機能）。
  // 楽観的更新はしない。書き込み成功後は invalidateStockNotesCache → revalidateData の順で必ず再取得する
  // （呼び忘れると「登録したのに画面に出ない」不具合になる。詳細は decision-log 参照）。
  const stockMaster = useStockNotesStockMaster();
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerCode, setRegisterCode] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerCategory, setRegisterCategory] = useState<StockNoteCategory>("watch");
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  // 分類変更・アーカイブ・削除の書き込み中は対象銘柄のIDを保持し、行のボタンを無効化する。
  const [rowBusyStockId, setRowBusyStockId] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportSubmitting, setBulkImportSubmitting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResult | null>(null);
  // 確認画面を開いた時点の対象一覧のスナップショット。unregisteredHoldings（最新の state）を
  // そのまま確認・実行対象に使うと、確認を出した後に裏で再取得や保有リスト更新が起きて
  // 一覧が変わった場合、ユーザーが確認した銘柄と違う銘柄を登録しうる。開いた時点で固定し、
  // 閉じるまで unregisteredHoldings の変化を反映しない（詳細は decision-log 参照）。
  const [bulkImportSnapshot, setBulkImportSnapshot] = useState<UnregisteredHolding[]>([]);

  // 取得の「世代」を管理するガード。ユーザー切替・ログアウトが連続したときに、
  // 古いリクエストの結果が新しい画面を上書きしないようにする（詳細: logic.ts の createLoadGuard）。
  const loadGuardRef = useRef(createLoadGuard());
  // onAuthStateChange のサブスクリプションは effect 実行時に1回だけ張られるため、
  // 通常の state（userId）をそのままクロージャで参照すると、ログイン直後の値を
  // 拾えず古い値（null 等）を見てしまう（stale closure）。ログアウト時に「直前の
  // ユーザーID」を確実に取れるよう、ref にも同じ値を都度反映しておく。
  const userIdRef = useRef<string | null>(null);
  // 認証状態の「世代」ガード（createLoadGuard を流用）。
  // マウント時に張る supabase.auth.getUser() は非同期のため、その結果が返ってくる前に
  // アカウント切替（onAuthStateChange の SIGNED_IN/SIGNED_OUT）が先に起きることがある。
  // 例: A でログイン中に getUser() を発行 → 応答が届く前に B へ切り替わり
  // onAuthStateChange が先に uid=B で startForUser を開始 → 遅れて届いた getUser() の
  // 結果（uid=A）をそのまま適用すると、実際のセッションは B なのに uid=A で
  // 取得・表示・キャッシュ保存してしまう（別ユーザーのデータ混入）。
  // getUser() を呼ぶ直前にこのガードで世代を1つ進めて記録しておき、onAuthStateChange が
  // 発火するたびにも世代を進める。getUser() の結果を適用する前に世代が変わっていないか
  // 確認し、変わっていれば（＝より新しい認証イベントを先に処理済み）その結果は捨てる。
  const authGuardRef = useRef(createLoadGuard());
  const dashboardDataRef = useRef<DashboardData>(EMPTY_DASHBOARD_DATA);
  const stockNotesManifestRef = useRef<StockNotesManifest | null>(null);

  const resetData = useCallback(() => {
    dashboardDataRef.current = EMPTY_DASHBOARD_DATA;
    stockNotesManifestRef.current = null;
    setStocks([]);
    setAnalyses([]);
    setTheses([]);
    setActions([]);
    setHoldings([]);
    setHoldingsUpdatedAt(null);
    setEarnings(null);
    setBodies({});
    setExpandedStockId(null);
    setLoadErrorMessage(null);
    setLoadState("idle");
    setDataUpdatedAt(null);
    setIsRevalidating(false);
    setRevalidateError(null);
  }, []);

  const applyDashboardData = useCallback(
    (data: DashboardData, fetchedAt: string, manifest: StockNotesManifest | null = null) => {
      dashboardDataRef.current = data;
      stockNotesManifestRef.current = manifest;
    setStocks(data.stocks);
    setAnalyses(data.analyses);
    setTheses(data.theses);
    setActions(data.actions);
    setHoldings(data.holdings);
    setHoldingsUpdatedAt(data.holdingsUpdatedAt);
    setEarnings(data.earnings);
    setDataUpdatedAt(fetchedAt);
    },
    [],
  );

  /**
   * 差分APIを優先し、APIが未デプロイ・一時障害などの場合は既存のSupabase直接取得へ戻す。
   * 差分APIが401を返した場合は、loadDashboardDataがunauthorizedを返すためフォールバックしない。
   */
  const loadDashboard = useCallback(
    async (baseData: DashboardData | null, knownManifest: StockNotesManifest | null) => {
      if (!supabase) return { status: "error" as const, message: "Supabase client is not available" };
      const commonFetchers = {
        fetchStocks: () => fetchStocks(supabase),
        fetchAnalyses: () => fetchAnalyses(supabase),
        fetchTheses: () => fetchTheses(supabase),
        fetchOpenActions: () => fetchOpenActions(supabase),
        fetchHoldings,
        fetchEarnings,
      };
      const deltaResult = await loadDashboardData({
        ...commonFetchers,
        fetchStockNotesDelta,
        baseData: baseData ?? undefined,
        knownManifest,
      });
      if (deltaResult.status !== "error") return deltaResult;
      return loadDashboardData(commonFetchers);
    },
    [supabase],
  );

  /**
   * 通常（フォアグラウンド）のロード。キャッシュが無いとき・エラー後の「再読み込み」で使う。
   * ローディング画面を出し、失敗時は画面全体をエラー/未ログイン表示に切り替える
   * （このパスに来る時点でまだ画面に表示できるデータが無いため、維持すべきキャッシュも無い）。
   */
  const loadData = useCallback(
    async (uid: string | null) => {
      if (!supabase) return;
      const token = loadGuardRef.current.next();
      setLoadState("loading");
      setLoadErrorMessage(null);
      setRevalidateError(null);
      // このフォアグラウンドロードが、進行中だったバックグラウンド再取得（revalidateData）を
      // 供給元として上書きする。revalidateData 側は「自分の取得が今も最新か」でしか
      // isRevalidating を解除しないため、そのまま放置すると「更新中…」が消えなくなる
      // （旧revalidateDataが世代不一致で早期returnし、かつ後続のこのloadDataがisRevalidatingに
      // 触れないと解除されない、という不具合があった）。ここで同期的に false にしておくことで、
      // どちらが先に解決しても最終的に正しい状態に収束する。
      setIsRevalidating(false);
      const result = await loadDashboard(null, null);
      // 完了までの間により新しい取得が始まっていたら、この結果は古いので画面に反映しない。
      if (!loadGuardRef.current.isCurrent(token)) return;

      if (result.status === "ok") {
        const fetchedAtIso = new Date().toISOString();
        const data: DashboardData = {
          stocks: result.stocks,
          analyses: result.analyses,
          theses: result.theses,
          actions: result.actions,
          holdings: result.holdings,
          holdingsUpdatedAt: result.holdingsUpdatedAt,
          earnings: result.earnings,
        };
        applyDashboardData(data, fetchedAtIso, result.stockNotesManifest ?? null);
        setLoadState("loaded");
        if (uid) writeStockNotesCache(uid, data, Date.now(), result.stockNotesManifest);
      } else if (result.status === "unauthorized") {
        if (uid) invalidateStockNotesCache(uid);
        setLoadErrorMessage(result.message);
        setLoadState("unauthorized");
      } else {
        setLoadErrorMessage(result.message);
        setLoadState("error");
      }
    },
    [supabase, applyDashboardData, loadDashboard],
  );

  /**
   * stale-while-revalidate のバックグラウンド再取得（マウント時のキャッシュ表示後の裏取得、
   * および手動更新ボタン）。既に画面に何かが表示されている前提で呼ぶため、
   * 取得失敗時は画面をエラー表示に倒さず、表示中のデータをそのまま維持して
   * 「最新の取得に失敗しました（表示は HH:MM時点）」の案内だけ出す。
   * ただし 401（セッション切れ）は例外: 表示中のデータが無効なセッションのものになるため、
   * ログイン画面へ切り替え、ローカルキャッシュも破棄する。
   *
   * authToken（省略可）: 書き込み後の再取得（refetchAfterWrite）専用の認証世代ガード。
   * 書き込みハンドラが書き込み開始直前に authGuardRef.current.current() で記録した世代を
   * 渡す。取得が完了した時点でこの世代が古くなっていたら（＝取得中にユーザーが切り替わった）、
   * state 更新・キャッシュ保存を一切行わずに中止する。DBのINSERT/UPDATE/DELETE自体はRLSが
   * 別ユーザーの行への書き込みを拒否するため守られているが、ここで中止しないと
   * 「切替後のセッションで取得したデータを、切替前のユーザーIDのキャッシュキーへ保存する」
   * というキャッシュのユーザー境界の破れが起きる。通常のマウント時再取得・手動更新ボタンは
   * authToken を渡さない（呼び出し時点の uid は既に最新であり、この追加ガードは不要）。
   */
  const revalidateData = useCallback(
    async (
      uid: string | null,
      referenceFetchedAt: string | null,
      authToken?: number,
      knownManifest?: StockNotesManifest | null,
    ) => {
      if (!supabase) return;
      const token = loadGuardRef.current.next();
      setIsRevalidating(true);
      setRevalidateError(null);
      const result = await loadDashboard(dashboardDataRef.current, knownManifest ?? null);
      if (!loadGuardRef.current.isCurrent(token)) return;
      if (authToken !== undefined && !authGuardRef.current.isCurrent(authToken)) {
        // 取得中にユーザーが切り替わった。この結果は別ユーザーのセッションで取得したものなので、
        // state にもキャッシュにも一切反映しない（isRevalidating は解除しないままにするが、
        // 新しいユーザーの loadData/startForUser が同期的に false へ倒すため残り続けない。
        // loadGuardRef の世代不一致時と同じ設計方針）。
        return;
      }
      setIsRevalidating(false);

      if (result.status === "ok") {
        const fetchedAtIso = new Date().toISOString();
        const data: DashboardData = {
          stocks: result.stocks,
          analyses: result.analyses,
          theses: result.theses,
          actions: result.actions,
          holdings: result.holdings,
          holdingsUpdatedAt: result.holdingsUpdatedAt,
          earnings: result.earnings,
        };
        applyDashboardData(data, fetchedAtIso, result.stockNotesManifest ?? null);
        setLoadState("loaded");
        setLoadErrorMessage(null);
        if (uid) writeStockNotesCache(uid, data, Date.now(), result.stockNotesManifest);
        return;
      }

      if (result.status === "unauthorized") {
        if (uid) invalidateStockNotesCache(uid);
        resetData();
        setLoadErrorMessage(result.message);
        setLoadState("unauthorized");
        return;
      }

      // ネットワーク不調・サーバーエラー等の一般的な失敗はキャッシュ/前回表示を維持する。
      setRevalidateError(buildRevalidateFailureMessage(referenceFetchedAt));
    },
    [supabase, applyDashboardData, loadDashboard, resetData],
  );

  // 認証確認とログイン中のデータ読み込みを1つのeffectにまとめる。
  // 「effectがstateを更新→その値に依存する別のeffectが発火してさらにstateを更新」という
  // cascading effectを避けるため、ログイン確認直後に同じeffect内でloadDataを呼ぶ。
  useEffect(() => {
    // AccountClient と同じ認証確認パターン。ここでのstate更新は外部システム（Supabase auth）
    // からの状態同期であり、別effectへの連鎖ではなく同一effect内で完結させている。
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let active = true;

    // ログイン確定後の共通処理: キャッシュがあれば即座に描画してから裏で再取得する
    // （stale-while-revalidate）。キャッシュが無ければ従来どおりローディング表示から取得する。
    const startForUser = (uid: string) => {
      const cached = readStockNotesCache(uid);
      if (cached) {
        applyDashboardData(cached.data, cached.fetchedAt, cached.manifest);
        setLoadState("loaded");
        setLoadErrorMessage(null);
        revalidateData(uid, cached.fetchedAt, undefined, cached.manifest);
      } else {
        loadData(uid);
      }
    };

    // getUser() を呼ぶ直前に世代を1つ進めて記録する。この後 onAuthStateChange が
    // 一度でも発火すれば世代がさらに進むため、getUser() の結果が返ってきた時点で
    // 世代が一致しなければ「より新しい認証イベントを先に処理済み」と判断できる。
    const authTokenAtGetUserStart = authGuardRef.current.next();
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      // getUser() の結果を state に適用するかどうかに関わらず、認証確認は完了している。
      setAuthReady(true);
      if (!authGuardRef.current.isCurrent(authTokenAtGetUserStart)) {
        // 先に onAuthStateChange が発火し、そちらが正しい最新の認証状態を既に処理している。
        // この getUser() の結果は古いので、userId/email 等には一切反映しない
        // （反映すると別ユーザーのuidで取得・キャッシュ保存してしまう）。
        return;
      }
      const nextEmail = data.user?.email ?? null;
      const nextUserId = data.user?.id ?? null;
      userIdRef.current = nextUserId;
      setEmail(nextEmail);
      setUserId(nextUserId);
      if (nextEmail && nextUserId) {
        startForUser(nextUserId);
      } else {
        loadGuardRef.current.invalidate();
        resetData();
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // 世代を進める。これにより、まだ解決していない（先に呼んだ）getUser() の結果は
      // 古いものとして破棄される。
      authGuardRef.current.next();
      const nextEmail = session?.user?.email ?? null;
      const nextUserId = session?.user?.id ?? null;
      setEmail(nextEmail);
      setUserId(nextUserId);
      if (nextEmail && nextUserId) {
        // ユーザー切替（別アカウントでの再ログイン含む）でも新しい世代を発行するため、
        // 直前のユーザーの取得結果は自動的に無効化される。
        userIdRef.current = nextUserId;
        startForUser(nextUserId);
      } else {
        // ログアウト: 進行中の取得結果を無効化し、表示中のデータとローカルキャッシュ（このユーザー分）を
        // 即座にクリアする。同じ端末を他人が使う場合に前のユーザーの分析内容が残らないようにするため。
        const prevUserId = userIdRef.current;
        userIdRef.current = null;
        loadGuardRef.current.invalidate();
        if (prevUserId) invalidateStockNotesCache(prevUserId);
        resetData();
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadData, revalidateData, resetData, applyDashboardData]);

  const syncDaysAgo = useMemo(() => daysSinceSync(holdingsUpdatedAt), [holdingsUpdatedAt]);
  const syncState: SyncStaleness = useMemo(() => syncStaleness(holdingsUpdatedAt), [holdingsUpdatedAt]);
  const openActions = useMemo(() => sortOpenActions(actions), [actions]);
  const stockById = useMemo(() => new Map(stocks.map((s) => [s.id, s])), [stocks]);
  const filteredStocks = useMemo(
    () => stocksForTab(categoryTab, stocks, analyses, actions, earnings),
    [categoryTab, stocks, analyses, actions, earnings],
  );
  const tabCounts = useMemo(() => {
    const map = {} as Record<StockNotesTab, number>;
    for (const tab of STOCK_NOTES_TABS) {
      map[tab] = countStocksForTab(tab, stocks, analyses, actions, earnings);
    }
    return map;
  }, [stocks, analyses, actions, earnings]);
  const tabLabel = useCallback((tab: StockNotesTab) => `${TAB_BASE_LABELS[tab]} ${tabCounts[tab]}`, [tabCounts]);
  const tabOptions = useMemo(() => STOCK_NOTES_TABS.map(tabLabel), [tabLabel]);
  // マイ銘柄リストの保有銘柄のうち stock_notes_stocks に未登録のもの（一括取り込みバナー対象）。
  const unregisteredHoldings = useMemo(
    () => extractUnregisteredHoldings(holdings, stocks),
    [holdings, stocks],
  );

  async function copyPrompt(code: string, name: string) {
    const text = buildAnalysisPrompt(code, name);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((cur) => (cur === code ? null : cur)), 2000);
    } catch {
      // クリップボード権限が無い環境ではコピーだけ諦める（UIはクラッシュさせない）
    }
  }

  async function loadBody(analysisId: string) {
    if (!supabase) return;
    setBodies((prev) => ({ ...prev, [analysisId]: "loading" }));
    try {
      const res = await fetchAnalysisBody(supabase, analysisId);
      setBodies((prev) => ({ ...prev, [analysisId]: res.body ?? "(原文なし)" }));
    } catch {
      setBodies((prev) => ({ ...prev, [analysisId]: "error" }));
    }
  }

  /**
   * 書き込み成功後に共通で行う後処理: キャッシュ破棄 → 裏で再取得（画面はキャッシュ表示を維持したまま更新）。
   * authToken は書き込みハンドラが書き込み開始直前に authGuardRef.current.current() で記録した
   * 認証世代。ここで再確認し、書き込み中にユーザーが切り替わっていたら再取得・キャッシュ破棄ごと
   * 中止する（詳細は revalidateData の authToken パラメータのコメント参照）。
   */
  const refetchAfterWrite = useCallback(
    async (uid: string, authToken: number) => {
      if (!authGuardRef.current.isCurrent(authToken)) return;
      invalidateStockNotesCache(uid);
      await revalidateData(uid, dataUpdatedAt, authToken, stockNotesManifestRef.current);
    },
    [revalidateData, dataUpdatedAt],
  );

  function handleRegisterCodeChange(value: string) {
    setRegisterCode(value);
    const hit = stockMaster.lookupByCode(value);
    if (hit) setRegisterName(hit);
  }

  async function submitRegister() {
    if (!supabase || !userId) return;
    const trimmedCode = registerCode.trim();
    const trimmedName = registerName.trim();
    const validationError = validateNewStockInput(trimmedCode, trimmedName);
    if (validationError) {
      setRegisterError(validationError);
      return;
    }
    if (isCodeAlreadyRegistered(stocks, trimmedCode)) {
      setRegisterError("このコードは既に登録されています。");
      return;
    }
    // 書き込み開始直前の認証世代を記録する（refetchAfterWrite が完了後に再確認する）。
    const authToken = authGuardRef.current.current();
    setRegisterSubmitting(true);
    setRegisterError(null);
    try {
      await insertStock(supabase, userId, { code: trimmedCode, name: trimmedName, category: registerCategory });
      setRegisterCode("");
      setRegisterName("");
      setShowRegisterForm(false);
      await refetchAfterWrite(userId, authToken);
    } catch (e) {
      setRegisterError(
        isDuplicateStockError(e) ? "このコードは既に登録されています。" : e instanceof Error ? e.message : "登録に失敗しました。",
      );
    } finally {
      setRegisterSubmitting(false);
    }
  }

  /**
   * 分類を変更する。アーカイブへの変更時は任意の理由を window.prompt で受け取る
   * （このツールにモーダル基盤が無いため、既存のクリップボードコピー等と同様に
   * ブラウザ標準ダイアログで済ませる）。キャンセルした場合は変更しない。
   */
  async function handleCategoryChange(stock: StockNoteStock, nextCategory: StockNoteCategory) {
    if (!supabase || !userId || nextCategory === stock.category) return;
    let reason: string | undefined;
    if (nextCategory === "archived") {
      const input = window.prompt("アーカイブ理由（任意。空欄でも登録できます）", "");
      if (input === null) return; // キャンセル
      const trimmed = input.trim();
      // 空欄なら category_change_reason 列には触れない（undefined。既存の理由を保持する）。
      // 何か入力されていればそれで上書きする。
      if (trimmed !== "") reason = trimmed;
    }
    const authToken = authGuardRef.current.current();
    setRowBusyStockId(stock.id);
    try {
      await updateStockCategory(supabase, stock.id, nextCategory, reason);
      await refetchAfterWrite(userId, authToken);
    } catch (e) {
      window.alert(`分類の変更に失敗しました${e instanceof Error ? `（${e.message}）` : ""}`);
    } finally {
      setRowBusyStockId(null);
    }
  }

  /**
   * 銘柄を削除する。canDeleteStock（logic.ts）はUX上の事前チェックにすぎず、正しさの担保は
   * DB側の外部キー制約（restrict）にある。事前チェックをすり抜けた場合（表示中のキャッシュが
   * 古く、実際には分析が増えているのに0件に見えていた等）でもDBが 23503 を返して拒否するため、
   * ここでそれを検出し、生のPostgRESTエラーではなく「アーカイブしてください」という
   * 次のアクションが分かる文言に変換する。
   */
  async function handleDeleteStock(stock: StockNoteStock) {
    if (!supabase || !userId) return;
    if (!canDeleteStock(stock, analyses)) return;
    const confirmed = window.confirm(
      `${stock.code} ${stock.name} を削除します。この操作は取り消せません。よろしいですか？`,
    );
    if (!confirmed) return;
    const authToken = authGuardRef.current.current();
    setRowBusyStockId(stock.id);
    try {
      await deleteStockById(supabase, stock.id);
      await refetchAfterWrite(userId, authToken);
    } catch (e) {
      const message = isForeignKeyViolationError(e)
        ? "この銘柄には分析が残っているため削除できません。アーカイブしてください。"
        : `削除に失敗しました${e instanceof Error ? `（${e.message}）` : ""}`;
      window.alert(message);
    } finally {
      setRowBusyStockId(null);
    }
  }

  /**
   * 一括取り込みの確認画面を開く。この時点の unregisteredHoldings をスナップショットとして
   * 固定する（開いた後に一覧が変わっても、ユーザーが確認した対象のまま登録するため）。
   */
  function openBulkImport() {
    setBulkImportSnapshot(unregisteredHoldings);
    setBulkImportResult(null);
    setShowBulkImport(true);
  }

  /** 確認画面を閉じる。次回開いたときに古い結果・スナップショットが残らないようクリアする。 */
  function closeBulkImport() {
    setShowBulkImport(false);
    setBulkImportSnapshot([]);
    setBulkImportResult(null);
  }

  async function runBulkImport() {
    if (!supabase || !userId || bulkImportSnapshot.length === 0) return;
    const authToken = authGuardRef.current.current();
    setBulkImportSubmitting(true);
    setBulkImportResult(null);
    try {
      const result = await bulkInsertHoldingsAsStocks(
        supabase,
        userId,
        bulkImportSnapshot.map((h) => ({ code: h.code, name: h.name })),
      );
      setBulkImportResult(result);
      // 成功が1件以上のときはもちろん、成功0件でも重複（23505、別タブ等で先に登録済み）だけで
      // 終わった場合も再取得する。DBには既に反映されているのに古いキャッシュの「未登録」表示が
      // 残ってしまうため（shouldRefetchAfterBulkImport、logic.ts）。
      if (shouldRefetchAfterBulkImport(result)) {
        await refetchAfterWrite(userId, authToken);
      }
    } finally {
      setBulkImportSubmitting(false);
    }
  }

  return (
    <main style={{ padding: "24px 16px 96px" }}>
      <section style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16, minWidth: 0 }}>
        <header style={{ display: "grid", gap: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>
            銘柄分析ダッシュボード
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-sub)", margin: 0, lineHeight: 1.6 }}>
            stock-notes（カスタムGPT）に記録した銘柄分析と、マイ銘柄リストの保有銘柄を突き合わせて表示します。銘柄の登録・分類変更・アーカイブはこの画面から行えます。分析・見立ての追加はこの画面からはできません（分析はGPTの領域です）。
          </p>
        </header>

        {!configured ? (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-sub)" }}>
              このツールは現在この環境では利用できません（サーバー未設定）。
            </p>
          </div>
        ) : !authReady ? (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>読み込み中…</p>
          </div>
        ) : !email ? (
          <div style={card}>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-text-sub)", lineHeight: 1.6 }}>
              このツールはログインユーザー本人の分析データだけを表示します。ログインしてください。
            </p>
            <Link href="/account" style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}>
              ログインする
            </Link>
          </div>
        ) : loadState === "unauthorized" ? (
          <div style={card}>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-danger, #dc2626)", lineHeight: 1.6 }}>
              {loadErrorMessage ?? "セッションが切れています。ログインし直してください。"}
            </p>
            <Link href="/account" style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}>
              ログインし直す
            </Link>
          </div>
        ) : loadState === "error" ? (
          <div style={card}>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-danger, #dc2626)" }}>
              データの取得に失敗しました{loadErrorMessage ? `（${loadErrorMessage}）` : ""}。
            </p>
            <button type="button" onClick={() => loadData(userId)} style={subBtn}>
              再読み込み
            </button>
          </div>
        ) : loadState === "loading" || loadState === "idle" ? (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>データを取得中…</p>
          </div>
        ) : (
          <>
            {/* stale-while-revalidate の状態表示。キャッシュ表示中でも「最終更新」が分かるようにし、
                手動更新ボタンでキャッシュを無視した再取得ができるようにする。 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {isRevalidating
                  ? "更新中…"
                  : dataUpdatedAt
                    ? `最終更新 ${formatClockTime(dataUpdatedAt) ?? "-"}`
                    : ""}
              </span>
              <button
                type="button"
                onClick={() => revalidateData(userId, dataUpdatedAt, undefined, stockNotesManifestRef.current)}
                disabled={isRevalidating}
                style={{ ...subBtn, opacity: isRevalidating ? 0.6 : 1 }}
              >
                {isRevalidating ? "更新中…" : "今すぐ更新"}
              </button>
            </div>
            {revalidateError && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-danger, #dc2626)", lineHeight: 1.6 }}>
                {revalidateError}
              </p>
            )}

            {/* 保有リストの同期状態。my-stocks はローカルが正本で、/account の「この端末を保存」を
                押した時だけクラウドへアップロードされる（自動同期ではない）。ここで表示している
                「未分析◯件」等の数字が古い保有リストに基づく可能性があることを伝える。 */}
            <div
              style={{
                ...card,
                borderColor: syncState === "fresh" ? "var(--color-border)" : "rgba(220,38,38,0.4)",
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-sub)" }}>
                保有リストの同期:{" "}
                {holdingsUpdatedAt && syncState !== "unknown" ? (
                  <>
                    {formatDate(holdingsUpdatedAt)}
                    {syncDaysAgo != null && `（${syncDaysAgo}日前）`}
                  </>
                ) : (
                  "未同期"
                )}
              </p>
              {syncState === "stale" && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-danger, #dc2626)", lineHeight: 1.6 }}>
                  同期が{SYNC_STALE_DAYS}日以上前です。保有リストが更新されている場合、この画面の「未分析◯件」などの数字は古い可能性があります。マイ銘柄リストを更新した場合は、
                  <Link href="/account" style={{ color: "var(--color-danger, #dc2626)", fontWeight: 700 }}>
                    /account
                  </Link>
                  の「この端末を保存」を押してください。
                </p>
              )}
              {syncState === "unknown" && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-danger, #dc2626)", lineHeight: 1.6 }}>
                  保有リストの同期日時を確認できません。マイ銘柄リストを更新した場合は、
                  <Link href="/account" style={{ color: "var(--color-danger, #dc2626)", fontWeight: 700 }}>
                    /account
                  </Link>
                  の「この端末を保存」を押してください。
                </p>
              )}
            </div>

            {/* マイ銘柄リストからの一括取り込みバナー（タブの外）。
                いきなり書き込まず、対象一覧を確認してから「まとめて登録」する2段階にする。
                対象一覧は openBulkImport で開いた時点の unregisteredHoldings をスナップショット
                固定したもの（bulkImportSnapshot）を表示・登録に使う。開いた後に裏の再取得等で
                unregisteredHoldings が変わっても、ユーザーが確認した対象のまま登録するため。
                表示条件は unregisteredHoldings.length>0 だけでなく bulkImportResult の有無も見る:
                全件成功すると unregisteredHoldings は即座に0件になるが、そこでバナーごと消すと
                「実行したのに何も起きなかった」ように見えてしまうため、結果が残っている間は
                バナー自体を表示し続け、閉じるまで成功件数を確認できるようにする。 */}
            {(unregisteredHoldings.length > 0 || bulkImportResult !== null) && (
              <div style={{ ...card, borderColor: "var(--color-accent)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--color-text)", lineHeight: 1.6 }}>
                    {unregisteredHoldings.length > 0
                      ? `マイ銘柄リストに未登録の保有が${unregisteredHoldings.length}件あります。`
                      : "一括登録が完了しました。"}
                  </p>
                  <button
                    type="button"
                    onClick={() => (showBulkImport ? closeBulkImport() : openBulkImport())}
                    style={subBtn}
                  >
                    {showBulkImport ? "閉じる" : "まとめて登録"}
                  </button>
                </div>
                {showBulkImport && (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                      {bulkImportSnapshot.map((h) => (
                        <li key={h.code} style={{ fontSize: 12, color: "var(--color-text-sub)" }}>
                          {h.code} {h.name}
                          {h.quantity != null && `（${h.quantity.toLocaleString("ja-JP")}株）`}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={runBulkImport}
                      disabled={bulkImportSubmitting || bulkImportResult !== null}
                      style={{
                        ...primaryBtn,
                        opacity: bulkImportSubmitting || bulkImportResult !== null ? 0.6 : 1,
                        width: "fit-content",
                      }}
                    >
                      {bulkImportSubmitting
                        ? "登録中…"
                        : `${bulkImportSnapshot.length}件を「保有」としてまとめて登録`}
                    </button>
                    {bulkImportResult && (
                      <div style={{ display: "grid", gap: 2 }}>
                        {bulkImportResult.succeeded.length > 0 && (
                          <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-sub)" }}>
                            {bulkImportResult.succeeded.length}件登録しました。
                          </p>
                        )}
                        {bulkImportResult.failed.map((f) => (
                          <p key={f.code} style={{ margin: 0, fontSize: 12, color: "var(--color-danger, #dc2626)" }}>
                            {f.code} {f.name}: {f.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 1. 銘柄一覧（5タブ: 要対応/保有/ウォッチ/新規調査/アーカイブ） */}
            <section style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <h2 style={sectionTitle}>銘柄一覧</h2>
                <button type="button" onClick={() => setShowRegisterForm((v) => !v)} style={subBtn}>
                  {showRegisterForm ? "閉じる" : "＋ 銘柄を登録"}
                </button>
              </div>

              {showRegisterForm && (
                <div style={card}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--color-text-sub)" }}>証券コード</span>
                      <input
                        type="text"
                        value={registerCode}
                        onChange={(e) => handleRegisterCodeChange(e.target.value)}
                        placeholder="例: 7203"
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--color-border-strong)",
                          background: "var(--color-bg-input)",
                          color: "var(--color-text)",
                          fontSize: 13,
                        }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--color-text-sub)" }}>
                        銘柄名{stockMaster.ready && !stockMaster.error ? "（マスターから自動補完。米国株等は手入力）" : ""}
                      </span>
                      <input
                        type="text"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        placeholder="例: トヨタ自動車"
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--color-border-strong)",
                          background: "var(--color-bg-input)",
                          color: "var(--color-text)",
                          fontSize: 13,
                        }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--color-text-sub)" }}>分類</span>
                      <select
                        value={registerCategory}
                        onChange={(e) => setRegisterCategory(e.target.value as StockNoteCategory)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--color-border-strong)",
                          background: "var(--color-bg-input)",
                          color: "var(--color-text)",
                          fontSize: 13,
                        }}
                      >
                        {CATEGORY_SELECT_OPTIONS.filter((c) => c !== "archived").map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {registerError && (
                      <p style={{ margin: 0, fontSize: 12, color: "var(--color-danger, #dc2626)" }}>{registerError}</p>
                    )}
                    <button
                      type="button"
                      onClick={submitRegister}
                      disabled={registerSubmitting}
                      style={{ ...primaryBtn, opacity: registerSubmitting ? 0.6 : 1, width: "fit-content" }}
                    >
                      {registerSubmitting ? "登録中…" : "登録する"}
                    </button>
                  </div>
                </div>
              )}

              <TabBar
                options={tabOptions}
                value={tabLabel(categoryTab)}
                onChange={(label) => {
                  const tab = STOCK_NOTES_TABS.find((t) => tabLabel(t) === label);
                  if (tab) setCategoryTab(tab);
                }}
              />
              {filteredStocks.length === 0 ? (
                <p style={emptyText}>この分類の銘柄はまだありません。</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {filteredStocks.map((stock) => (
                    <StockRow
                      key={stock.id}
                      stock={stock}
                      analyses={analyses}
                      theses={theses}
                      actions={actions}
                      earnings={earnings}
                      expanded={expandedStockId === stock.id}
                      onToggle={() =>
                        setExpandedStockId((cur) => (cur === stock.id ? null : stock.id))
                      }
                      bodies={bodies}
                      onLoadBody={loadBody}
                      busy={rowBusyStockId === stock.id}
                      onCategoryChange={(next) => handleCategoryChange(stock, next)}
                      onDelete={() => handleDeleteStock(stock)}
                      showActionRequiredReasons={categoryTab === "action-required"}
                      onCopyPrompt={
                        categoryTab === "action-required" ? () => copyPrompt(stock.code, stock.name) : undefined
                      }
                      copied={copiedCode === stock.code}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* 2. アクション受信箱 */}
            <section style={{ display: "grid", gap: 10 }}>
              <h2 style={sectionTitle}>アクション受信箱（{openActions.length}件）</h2>
              {openActions.length === 0 ? (
                <p style={emptyText}>未消化のアクションはありません。</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {openActions.map((action) => {
                    const stock = stockById.get(action.stockId);
                    const overdue = isOverdue(action.dueDate);
                    return (
                      <li key={action.id} style={card}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          {stock && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text-muted)" }}>
                              {stock.code} {stock.name}
                            </span>
                          )}
                          {action.dueDate && (
                            <span style={badgeStyle(overdue ? "rgba(220,38,38,0.14)" : "var(--color-bg-input)", overdue ? "#dc2626" : "var(--color-text-sub)")}>
                              期限 {formatDate(action.dueDate)}{overdue ? "（期限切れ）" : ""}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, color: "var(--color-text)", fontSize: 14, marginTop: 4 }}>
                          {action.title}
                        </div>
                        {action.detail && (
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-sub)", lineHeight: 1.6 }}>
                            {action.detail}
                          </p>
                        )}
                        {action.triggerCondition && (
                          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--color-text-muted)" }}>
                            トリガー: {action.triggerCondition}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

/**
 * lastEarningsDate が分かる場合、post-earnings のラベルに日付を入れる
 * （「要更新（決算後未分析）」ではなく「8/4の決算後、未分析」）。
 * 利用者が何を確認すべきか（いつの決算を踏まえて分析すべきか）を即座に分かるようにするため。
 */
function FreshnessBadge({
  level,
  lastEarningsDate,
}: {
  level: FreshnessLevelV2;
  lastEarningsDate?: string | null;
}) {
  const info = FRESHNESS_COLORS[level];
  if (!info) return null;
  const label =
    level === "post-earnings" && lastEarningsDate
      ? `${formatMonthDay(lastEarningsDate)}の決算後、未分析`
      : info.label;
  return <span style={badgeStyle(info.bg, info.fg)}>{label}</span>;
}

/**
 * 「要対応」タブの理由バッジの配色。unanalyzed / post-earnings / overdue-action は
 * FRESHNESS_COLORS の danger と同じ配色（要更新系はすべて赤で統一）、action-due-soon は
 * warn と同じ配色（まだ期限切れではないが迫っている、という段階の違いを色で表す）。
 */
const REASON_BADGE_COLORS: Record<ActionRequiredReason["kind"], { bg: string; fg: string }> = {
  unanalyzed: { bg: "rgba(220,38,38,0.14)", fg: "#dc2626" },
  "post-earnings": { bg: "rgba(220,38,38,0.14)", fg: "#dc2626" },
  "overdue-action": { bg: "rgba(220,38,38,0.14)", fg: "#dc2626" },
  "action-due-soon": { bg: "rgba(217,119,6,0.14)", fg: "#d97706" },
};

function reasonBadgeLabel(reason: ActionRequiredReason): string {
  switch (reason.kind) {
    case "unanalyzed":
      return "未分析";
    case "post-earnings":
      return `${formatMonthDay(reason.earningsDate)}の決算後`;
    case "overdue-action":
      return "期限切れ";
    case "action-due-soon":
      return "期限間近";
  }
}

/**
 * 「要対応」タブの行専用の理由バッジ群。なぜこの銘柄が要対応なのかを、該当する条件だけ
 * 全て並べて示す（未分析／決算後未分析／期限切れ／期限間近は同時に複数該当しうる）。
 * このタブでは既存の FreshnessBadge の代わりにこちらを表示する（役割の重複を避けるため。
 * 詳細は decision-log 参照）。
 */
function ActionRequiredReasonBadges({ reasons }: { reasons: ActionRequiredReason[] }) {
  if (reasons.length === 0) return null;
  return (
    <>
      {reasons.map((reason, i) => {
        const colors = REASON_BADGE_COLORS[reason.kind];
        return (
          <span key={`${reason.kind}-${i}`} style={badgeStyle(colors.bg, colors.fg)}>
            {reasonBadgeLabel(reason)}
          </span>
        );
      })}
    </>
  );
}

function StockRow({
  stock,
  analyses,
  theses,
  actions,
  earnings,
  expanded,
  onToggle,
  bodies,
  onLoadBody,
  busy,
  onCategoryChange,
  onDelete,
  showActionRequiredReasons,
  onCopyPrompt,
  copied,
}: {
  stock: StockNoteStock;
  analyses: StockNoteAnalysis[];
  theses: StockNoteThesis[];
  actions: StockNoteAction[];
  earnings: StockNotesEarningsInfo | null;
  expanded: boolean;
  onToggle: () => void;
  bodies: Record<string, string | "loading" | "error">;
  onLoadBody: (analysisId: string) => void;
  busy: boolean;
  onCategoryChange: (next: StockNoteCategory) => void;
  onDelete: () => void;
  /** 「要対応」タブで表示中かどうか。true のとき FreshnessBadge の代わりに理由バッジを出し、
   *  「分析用プロンプトをコピー」ボタンも行に表示する（この2つは要対応タブ専用）。 */
  showActionRequiredReasons: boolean;
  onCopyPrompt?: () => void;
  copied?: boolean;
}) {
  const thesis = selectLatestThesis(theses, stock.id);
  const lastAnalyzed = latestAnalyzedAt(analyses, stock.id);
  // 鮮度は「決算またぎ」を優先し、経過日数（90日/180日）は補助として使う。
  // 決算日が未判明の場合は従来どおり経過日数のみで判定する。
  const lastEarningsDate = earnings?.lastEarnings[stock.code]?.date ?? null;
  const level = freshnessLevelWithEarnings(lastAnalyzed, lastEarningsDate);
  const reasons = showActionRequiredReasons
    ? actionRequiredReasons(stock, analyses, actions, earnings?.lastEarnings ?? {})
    : [];
  const analysisCount = analysisCountForStock(analyses, stock.id);
  const openActions = openActionCountForStock(actions, stock.id);
  const timeline = expanded ? analysesForStock(analyses, stock.id) : [];
  const earningsInfo = earningsDisplay(stock.code, earnings);
  const canDelete = canDeleteStock(stock, analyses);
  const deleteReason = deleteBlockedReason(stock, analyses);
  // 次回決算が未判明のときだけ前回決算を目立たせる（唯一の手がかりになるため）。
  const emphasizeLast = !earnings?.earnings[stock.code] && !earningsInfo.failed;
  const lastEarningsText = lastEarningsDisplay(stock.code, earnings, emphasizeLast);

  return (
    <li style={card}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 900, color: "var(--color-text)", fontSize: 14 }}>{stock.code}</span>
          <span style={{ color: "var(--color-text)", fontSize: 13 }}>{stock.name}</span>
          {thesis && (
            <span
              style={badgeStyle(
                withFallback(VIEW_COLORS, thesis.view, VIEW_COLORS.neutral).bg,
                withFallback(VIEW_COLORS, thesis.view, VIEW_COLORS.neutral).fg,
              )}
            >
              {withFallback(VIEW_LABELS, thesis.view, "不明")}
            </span>
          )}
          {thesis && (
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {withFallback(CONFIDENCE_LABELS, thesis.confidence, "確信度不明")}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            最終分析 {formatDate(lastAnalyzed)}
          </span>
          {showActionRequiredReasons ? (
            <ActionRequiredReasonBadges reasons={reasons} />
          ) : (
            <FreshnessBadge level={level} lastEarningsDate={lastEarningsDate} />
          )}
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>分析{analysisCount}件</span>
          {openActions > 0 && (
            <span style={badgeStyle("var(--color-accent-sub)", "var(--color-accent)")}>
              未消化アクション{openActions}件
            </span>
          )}
        </div>
        <div style={{ marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={earningsInfo.soon ? dangerText : { fontSize: 11, color: "var(--color-text-muted)" }}>
            {earningsInfo.text}
          </span>
          {lastEarningsText && (
            <span
              style={
                emphasizeLast
                  ? { fontSize: 12, color: "var(--color-accent)", fontWeight: 800 }
                  : { fontSize: 11, color: "var(--color-text-muted)" }
              }
            >
              {lastEarningsText}
            </span>
          )}
        </div>
      </button>

      {/* 「分析用プロンプトをコピー」は要対応タブの行にのみ表示する（旧・保有だが未分析セクションに
          あったボタンをここへ移設した）。トグルボタンの中に別のボタンをネストできないため、
          トグルボタンの外の兄弟要素として配置する。 */}
      {onCopyPrompt && (
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={onCopyPrompt} style={subBtn}>
            {copied ? "コピーしました" : "分析用プロンプトをコピー"}
          </button>
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)", display: "grid", gap: 12 }}>
          {thesis ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 800 }}>
                現在の見立て（{formatDate(thesis.asOf)}時点）
              </div>
              <ThesisList label="仮説" items={thesis.thesis} />
              <ThesisList label="リスク" items={thesis.risks} />
              <ThesisList label="次回確認点" items={thesis.nextCheck} />
              {thesis.buyMoreCondition && (
                <div style={{ fontSize: 12, color: "var(--color-text-sub)" }}>
                  買い増し条件: {thesis.buyMoreCondition}
                </div>
              )}
              {thesis.exitCondition && (
                <div style={{ fontSize: 12, color: "var(--color-text-sub)" }}>
                  撤退条件: {thesis.exitCondition}
                </div>
              )}
            </div>
          ) : (
            <p style={emptyText}>見立ての記録がまだありません。</p>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 800 }}>
              分析タイムライン（新しい順）
            </div>
            {timeline.length === 0 ? (
              <p style={emptyText}>分析の記録がまだありません。</p>
            ) : (
              timeline.map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text-muted)" }}>
                      {formatDate(a.analyzedAt)}
                    </span>
                    <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
                      {withFallback(ANALYSIS_TYPE_LABELS, a.analysisType, "その他")}
                    </span>
                  </div>
                  {a.conclusion && (
                    <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 700 }}>{a.conclusion}</div>
                  )}
                  {a.evidence && (
                    <div style={{ fontSize: 12, color: "var(--color-text-sub)" }}>根拠: {a.evidence}</div>
                  )}
                  {a.concerns && (
                    <div style={{ fontSize: 12, color: "var(--color-text-sub)" }}>懸念: {a.concerns}</div>
                  )}
                  {a.sourceUrl && (
                    <a
                      href={a.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{ fontSize: 11, color: "var(--color-accent)" }}
                    >
                      出典を開く
                    </a>
                  )}
                  <div>
                    {bodies[a.id] === undefined ? (
                      <button type="button" onClick={() => onLoadBody(a.id)} style={subBtn}>
                        原文を表示
                      </button>
                    ) : bodies[a.id] === "loading" ? (
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>読み込み中…</span>
                    ) : bodies[a.id] === "error" ? (
                      <span style={{ fontSize: 12, color: "var(--color-danger, #dc2626)" }}>
                        原文の取得に失敗しました
                      </span>
                    ) : (
                      <div
                        style={{
                          marginTop: 4,
                          maxHeight: 320,
                          overflowY: "auto",
                          overflowX: "hidden",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 12,
                          color: "var(--color-text-sub)",
                          background: "var(--color-bg-input)",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        {bodies[a.id]}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 分類変更・アーカイブ・削除。アーカイブが基本、削除は例外
              （on delete cascade で分析・見立て・アクションが全部消えるため）。 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
              paddingTop: 8,
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-sub)" }}>
              分類
              <select
                value={stock.category}
                disabled={busy}
                onChange={(e) => onCategoryChange(e.target.value as StockNoteCategory)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border-strong)",
                  background: "var(--color-bg-input)",
                  color: "var(--color-text)",
                  fontSize: 12,
                }}
              >
                {CATEGORY_SELECT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy || !canDelete}
              title={deleteReason ?? undefined}
              style={{
                ...subBtn,
                color: canDelete ? "var(--color-danger, #dc2626)" : "var(--color-text-muted)",
                opacity: busy || !canDelete ? 0.5 : 1,
                cursor: busy || !canDelete ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "処理中…" : "削除"}
            </button>
          </div>
          {deleteReason && (
            <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              {deleteReason}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function ThesisList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-text-sub)", fontWeight: 700 }}>{label}</div>
      <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12, color: "var(--color-text-sub)", lineHeight: 1.6 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
