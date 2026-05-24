import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { fetchJson, getApiBaseUrl } from "@/lib/market-api";

export const metadata: Metadata = {
  title: "Admin Dashboard | mini-tools",
  description: "各ツールのデータソース・更新ルール・実更新日を確認する管理画面。",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin" },
};

export const dynamic = "force-dynamic";

type ToolRow = {
  name: string;
  href: string;
  source: string;
  rule: string;
  note?: string;
  /** 動的取得済みの最終更新日 (YYYY-MM-DD)。null = 未取得/取得失敗、undefined = 動的取得対象外 */
  latest?: string | null;
  /** マニフェスト取得時刻 */
  fetchedAt?: string;
};

type ManifestFetchResult = {
  latest: string | null;
  fetchedAt: string;
};

async function fetchManifestLatest(
  endpoint: string,
  pick: (json: unknown) => string | null,
): Promise<ManifestFetchResult> {
  const apiBase = getApiBaseUrl();
  const fetchedAt = new Date().toISOString();
  if (!apiBase) return { latest: null, fetchedAt };
  try {
    const json = await fetchJson<unknown>(`${apiBase}${endpoint}`, 60);
    return { latest: pick(json), fetchedAt };
  } catch {
    return { latest: null, fetchedAt };
  }
}

function pickString(obj: unknown, key: string): string | null {
  if (obj && typeof obj === "object" && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function pickFirstDate(obj: unknown): string | null {
  if (obj && typeof obj === "object" && "dates" in obj) {
    const dates = (obj as Record<string, unknown>).dates;
    if (Array.isArray(dates) && typeof dates[0] === "string") {
      return dates[0];
    }
  }
  return null;
}

async function loadRows(): Promise<ToolRow[]> {
  const [
    topix33,
    nikkei,
    stockRanking,
    usRanking,
    earningsDom,
    earningsOv,
    econ,
    edinet,
    yutai,
    marketCap,
    dividendYield,
  ] = await Promise.all([
    fetchManifestLatest("/topix33/manifest", (j) => pickString(j, "latest_date") ?? pickFirstDate(j)),
    fetchManifestLatest("/nikkei/manifest", (j) => pickString(j, "latest_date") ?? pickFirstDate(j)),
    fetchManifestLatest("/ranking/manifest", (j) => pickString(j, "latest") ?? pickFirstDate(j)),
    fetchManifestLatest("/us-ranking/manifest", (j) => pickString(j, "latest") ?? pickFirstDate(j)),
    fetchManifestLatest("/earnings-calendar/domestic/manifest", (j) => pickString(j, "as_of_date")),
    fetchManifestLatest("/earnings-calendar/overseas/manifest", (j) => pickString(j, "as_of_date")),
    fetchManifestLatest("/econ-calendar/weekly/manifest", (j) => pickString(j, "generated_at")),
    fetchManifestLatest("/edinet/document-list/manifest", (j) => pickFirstDate(j)),
    fetchManifestLatest("/yutai/manifest", (j) => pickString(j, "generated_at")),
    fetchManifestLatest("/market-rankings/market-cap/manifest", (j) => pickString(j, "generatedAt") ?? pickString(j, "latest")),
    fetchManifestLatest("/market-rankings/dividend-yield/manifest", (j) => pickString(j, "generatedAt") ?? pickString(j, "latest")),
  ]);

  const [nikkoCredit, sbiCredit, tdnet, jpxClosed] = await Promise.all([
    fetchManifestLatest("/nikko/credit", (j) => pickString(j, "date") ?? pickString(j, "generated_at")),
    fetchManifestLatest("/sbi/credit/latest", (j) => pickString(j, "date") ?? pickString(j, "generated_at")),
    fetchManifestLatest("/tdnet/disclosures/latest", (j) => pickString(j, "target_date")),
    fetchManifestLatest("/market-calendar/jpx-closed", (j) => pickString(j, "as_of_date")),
  ]);

  return [
    {
      name: "合計計算",
      href: "/tools/total",
      source: "ブラウザ localStorage",
      rule: "ユーザー入力のみ。サーバーへ送信なし。",
    },
    {
      name: "文字数カウント",
      href: "/tools/charcount",
      source: "ブラウザ localStorage",
      rule: "ユーザー入力のみ。サーバーへ送信なし。",
    },
    {
      name: "株主優待期限帳",
      href: "/tools/yutai-expiry",
      source: "ブラウザ localStorage + scan API (premium)",
      rule: "ユーザー入力ベース。scan 機能のみ premium auth で外部 API。",
    },
    {
      name: "優待銘柄メモ帳",
      href: "/tools/yutai-memo",
      source: "ブラウザ localStorage",
      rule: "ユーザー入力のみ。サーバーへ送信なし。",
    },
    {
      name: "優待カレンダー",
      href: "/tools/yutai-candidates",
      source: "market-info API: /yutai/manifest",
      rule: "月次。manifest の generated_at をデータ生成時刻として表示。",
      latest: yutai.latest,
      fetchedAt: yutai.fetchedAt,
    },
    {
      name: "優待カレンダー: 日興信用データ",
      href: "/tools/yutai-candidates",
      source: "market-info API: /nikko/credit",
      rule: "日次。日興証券の貸借/一般信用銘柄を取り込み。レスポンスの date を表示。",
      latest: nikkoCredit.latest,
      fetchedAt: nikkoCredit.fetchedAt,
    },
    {
      name: "優待カレンダー: SBI信用データ",
      href: "/tools/yutai-candidates",
      source: "market-info API: /sbi/credit/latest",
      rule: "日次。SBI一般信用 (短期) の在庫を取り込み。レスポンスの date を表示。",
      latest: sbiCredit.latest,
      fetchedAt: sbiCredit.fetchedAt,
    },
    {
      name: "決算カレンダー (国内)",
      href: "/tools/earnings-calendar",
      source: "market-info API: /earnings-calendar/domestic/manifest",
      rule: "日次 (営業日朝)。as_of_date が当日 or 直近営業日。",
      latest: earningsDom.latest,
      fetchedAt: earningsDom.fetchedAt,
    },
    {
      name: "決算カレンダー (海外)",
      href: "/tools/earnings-calendar",
      source: "market-info API: /earnings-calendar/overseas/manifest",
      rule: "日次 (営業日朝)。as_of_date が当日 or 直近営業日。",
      latest: earningsOv.latest,
      fetchedAt: earningsOv.fetchedAt,
    },
    {
      name: "経済指標カレンダー",
      href: "/tools/econ-calendar",
      source: "market-info API: /econ-calendar/weekly/manifest",
      rule: "週次 (毎週月曜 JST 朝に翌週分を確定)。manifest の generated_at を表示。",
      latest: econ.latest,
      fetchedAt: econ.fetchedAt,
    },
    {
      name: "市場ランキング (時価総額)",
      href: "/tools/market-rankings",
      source: "market-info API: /market-rankings/market-cap/manifest",
      rule: "月次。月初に前月分を確定。manifest の generatedAt を表示。",
      latest: marketCap.latest,
      fetchedAt: marketCap.fetchedAt,
    },
    {
      name: "市場ランキング (配当利回り)",
      href: "/tools/market-rankings",
      source: "market-info API: /market-rankings/dividend-yield/manifest",
      rule: "月次。月初に前月分を確定。manifest の generatedAt を表示。",
      latest: dividendYield.latest,
      fetchedAt: dividendYield.fetchedAt,
    },
    {
      name: "株価ランキング",
      href: "/tools/stock-ranking",
      source: "market-info API: /ranking/manifest",
      rule: "日次 (大引け後)。値上がり/値下がり/売買高。",
      latest: stockRanking.latest,
      fetchedAt: stockRanking.fetchedAt,
    },
    {
      name: "米国株ランキング",
      href: "/tools/us-stock-ranking",
      source: "market-info API: /us-ranking/manifest",
      rule: "日次 (米国大引け後)。",
      latest: usRanking.latest,
      fetchedAt: usRanking.fetchedAt,
    },
    {
      name: "日経225寄与度",
      href: "/tools/nikkei-contribution",
      source: "market-info API: /nikkei/manifest",
      rule: "日次 (大引け後)。",
      latest: nikkei.latest,
      fetchedAt: nikkei.fetchedAt,
    },
    {
      name: "TOPIX33業種",
      href: "/tools/topix33",
      source: "market-info API: /topix33/manifest",
      rule: "日次 (大引け後)。",
      latest: topix33.latest,
      fetchedAt: topix33.fetchedAt,
    },
    {
      name: "EDINET書類一覧",
      href: "/tools/edinet-documents",
      source: "market-info API: /edinet/document-list/manifest",
      rule: "日次。EDINET 公開分を当日中に取り込み。",
      latest: edinet.latest,
      fetchedAt: edinet.fetchedAt,
    },
    {
      name: "TDNET適時開示一覧",
      href: "/tools/tdnet-disclosures",
      source: "market-info API: /tdnet/disclosures/latest",
      rule: "日次。最新日付 endpoint の target_date を表示。",
      latest: tdnet.latest,
      fetchedAt: tdnet.fetchedAt,
    },
    {
      name: "JPX 祝日カレンダー (共通参照)",
      href: "/tools/earnings-calendar",
      source: "market-info API: /market-calendar/jpx-closed",
      rule: "祝日・市場休場日の参照データ。複数ツール共通。as_of_date を表示。",
      latest: jpxClosed.latest,
      fetchedAt: jpxClosed.fetchedAt,
    },
    {
      name: "ペンギン・エイリアンシューター",
      href: "/tools/penguin-rabbit-shooter",
      source: "クライアントゲーム",
      rule: "データソースなし。",
    },
    {
      name: "ペンギンシューター",
      href: "/tools/penguin-shooter",
      source: "クライアントゲーム",
      rule: "データソースなし。",
    },
  ];
}

function StatusBadge({ row }: { row: ToolRow }) {
  if (row.latest === undefined) {
    return (
      <span style={{ ...badgeBase, background: "#f1f5f9", color: "#475569" }}>—</span>
    );
  }
  if (row.latest === null) {
    return (
      <span style={{ ...badgeBase, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
        取得失敗
      </span>
    );
  }
  return (
    <span style={{ ...badgeBase, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
      {row.latest}
    </span>
  );
}

const badgeBase = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

const cellStyle = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "top" as const,
  fontSize: 13,
  lineHeight: 1.6,
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/admin")}`);
  }

  const rows = await loadRows();
  const apiBase = getApiBaseUrl();
  const now = new Date().toISOString();

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 16px 72px" }}>
      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "#f1f5f9",
            color: "#334155",
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          Admin · noindex
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, letterSpacing: -0.5 }}>
          データ更新ダッシュボード
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.8 }}>
          各ツールのデータソース・更新ルール・最終更新日を一覧で確認します。<br />
          API ベース URL: <code>{apiBase || "(未設定)"}</code> ／ 表示時刻: <code>{now}</code>
        </p>
      </header>

      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={{ ...cellStyle, fontSize: 12, fontWeight: 800, color: "#475569" }}>ツール</th>
                <th style={{ ...cellStyle, fontSize: 12, fontWeight: 800, color: "#475569" }}>データソース</th>
                <th style={{ ...cellStyle, fontSize: 12, fontWeight: 800, color: "#475569" }}>更新ルール</th>
                <th style={{ ...cellStyle, fontSize: 12, fontWeight: 800, color: "#475569" }}>最終更新</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.name}-${row.href}`}>
                  <td style={cellStyle}>
                    <Link href={row.href} style={{ color: "var(--color-accent)", fontWeight: 700, textDecoration: "none" }}>
                      {row.name}
                    </Link>
                  </td>
                  <td style={{ ...cellStyle, color: "var(--color-text-sub)" }}>
                    <code style={{ fontSize: 12 }}>{row.source}</code>
                  </td>
                  <td style={{ ...cellStyle, color: "var(--color-text-sub)" }}>
                    {row.rule}
                    {row.note ? (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#92400e" }}>※ {row.note}</div>
                    ) : null}
                  </td>
                  <td style={cellStyle}>
                    <StatusBadge row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section style={{ marginTop: 24, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--color-text-sub)" }}>凡例</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>最終更新の日付は manifest API のレスポンスから動的取得しています。</li>
          <li>「—」は外部データを持たないツール (ローカル保存のみ等)。「取得失敗」は API 未設定 / タイムアウト / マニフェスト未提供。</li>
          <li>更新ルールは仕様ベースの記載で、実運用と差異がある場合は <Link href="/" style={{ color: "var(--color-accent)" }}>docs</Link> を更新してください。</li>
        </ul>
      </section>
    </main>
  );
}
