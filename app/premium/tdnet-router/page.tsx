import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { isSyncConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  REVIEW_LIMIT_OPTIONS,
  TDNET_ATTENTION_STATUSES,
  TDNET_EVENT_LABELS,
  TDNET_EVENT_TYPES,
  TDNET_STATUS_LABELS,
  loadTdnetReviewQueue,
  parseReviewLimit,
  parseTdnetAttentionStatus,
  parseTdnetEventType,
  type TdnetReviewEvent,
} from "./data";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "TDNET Router 確認キュー | mini-tools premium",
  description: "TDNET Routerが検知した未処理・要確認イベントを読み取り専用で確認します。",
  alternates: {
    canonical: "/premium/tdnet-router",
  },
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatJst(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function EventCard({ item }: { item: TdnetReviewEvent }) {
  return (
    <article className={styles.eventCard}>
      <div className={styles.eventHeader}>
        <div className={styles.badges}>
          <span className={styles.statusBadge}>
            {TDNET_STATUS_LABELS[item.route_status]}
          </span>
          <span className={styles.eventBadge}>
            {TDNET_EVENT_LABELS[item.event_type]}
          </span>
        </div>
        <time className={styles.time} dateTime={item.disclosed_at}>
          {formatJst(item.disclosed_at)}
        </time>
      </div>

      <div className={styles.companyRow}>
        <span className={styles.code}>{item.security_code}</span>
        <strong>{item.company_name ?? "会社名未接続"}</strong>
      </div>

      <p className={styles.title}>{item.title}</p>

      <dl className={styles.metaGrid}>
        <div>
          <dt>Source date</dt>
          <dd>{item.source_date}</dd>
        </div>
        <div>
          <dt>Ingested</dt>
          <dd>{formatJst(item.ingested_at)}</dd>
        </div>
        <div>
          <dt>Policy</dt>
          <dd>{item.policy_version}</dd>
        </div>
        <div>
          <dt>Disclosure ID</dt>
          <dd>{item.tdnet_disclosure_id}</dd>
        </div>
      </dl>

      <div className={styles.cardFooter}>
        <span className={styles.readOnlyNote}>読み取り専用</span>
        <a
          className={styles.pdfLink}
          href={item.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          TDNET PDFを開く
        </a>
      </div>
    </article>
  );
}

export default async function TdnetRouterReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; event?: string; limit?: string }>;
}) {
  const cookieStore = await cookies();
  const premiumSession = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(premiumSession)) {
    redirect(`/premium/login?next=${encodeURIComponent("/premium/tdnet-router")}`);
  }

  const rawFilters = await searchParams;
  const routeStatus = parseTdnetAttentionStatus(rawFilters.status);
  const eventType = parseTdnetEventType(rawFilters.event);
  const limit = parseReviewLimit(rawFilters.limit);

  let authState: "ready" | "not_configured" | "auth_required" | "error" = "ready";
  let errorMessage: string | null = null;
  let queue = null;

  if (!isSyncConfigured()) {
    authState = "not_configured";
  } else {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        authState = "auth_required";
      } else {
        queue = await loadTdnetReviewQueue(supabase, user.id, {
          routeStatus,
          eventType,
          limit,
        });
      }
    } catch (error) {
      console.error("Failed to load TDNET Router review queue", error);
      authState = "error";
      errorMessage = "TDNET Routerの確認キューを取得できませんでした。";
    }
  }

  return (
    <main className={styles.main}>
      <section className={styles.shell}>
        <nav className={styles.topNav}>
          <Link href="/premium">← Premium ホーム</Link>
          <Link href="/tools/disclosure-radar">通常の開示レーダー</Link>
        </nav>

        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>TDNET ROUTER / READ ONLY</p>
            <h1>TDNET Router 確認キュー</h1>
            <p>
              Routerが検知した重要開示の処理状態を確認します。この画面から状態変更や
              Canonical更新は行いません。
            </p>
          </div>
          <span className={styles.readOnlyPill}>READ ONLY</span>
        </header>

        <section className={styles.controls} aria-label="表示条件">
          <form className={styles.filterForm} method="get">
            <label>
              状態
              <select name="status" defaultValue={routeStatus ?? "all"}>
                <option value="all">未処理・要確認・失敗</option>
                {TDNET_ATTENTION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TDNET_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Event
              <select name="event" defaultValue={eventType ?? "all"}>
                <option value="all">すべて</option>
                {TDNET_EVENT_TYPES.map((event) => (
                  <option key={event} value={event}>
                    {TDNET_EVENT_LABELS[event]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              表示件数
              <select name="limit" defaultValue={String(limit)}>
                {REVIEW_LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}件
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.filterActions}>
              <button type="submit">適用</button>
              <Link href="/premium/tdnet-router">リセット</Link>
            </div>
          </form>
        </section>

        {authState === "not_configured" ? (
          <section className={styles.stateCard}>
            <h2>Supabase設定がありません</h2>
            <p>本人DBへ接続できる環境でのみ確認キューを表示します。</p>
          </section>
        ) : authState === "auth_required" ? (
          <section className={styles.stateCard}>
            <h2>Supabaseログインが必要です</h2>
            <p>Premium認証とは別に、本人データをRLSで読むためのログインが必要です。</p>
            <Link href="/account">アカウント・同期を開く</Link>
          </section>
        ) : authState === "error" ? (
          <section className={styles.stateCard}>
            <h2>取得に失敗しました</h2>
            <p>{errorMessage}</p>
          </section>
        ) : queue ? (
          <>
            <section className={styles.summaryGrid}>
              <div>
                <span>該当件数</span>
                <strong>{queue.totalCount}</strong>
              </div>
              <div>
                <span>表示中</span>
                <strong>{queue.items.length}</strong>
              </div>
              <div>
                <span>対象期間</span>
                <strong>Hot 180日</strong>
              </div>
            </section>

            {queue.items.length > 0 ? (
              <section className={styles.eventGrid}>
                {queue.items.map((item) => (
                  <EventCard
                    key={`${item.tdnet_disclosure_id}:${item.event_type}`}
                    item={item}
                  />
                ))}
              </section>
            ) : (
              <section className={styles.stateCard}>
                <h2>確認対象はありません</h2>
                <p>
                  現在の絞り込みに一致するRouter Eventはありません。これは取得失敗とは
                  区別された正常な空状態です。
                </p>
              </section>
            )}
          </>
        ) : null}

        <aside className={styles.boundaryNote}>
          Raw/full TDNET履歴の正本はmarket_info/R2です。この画面は直近180日の
          derived Hot Indexを確認するための運用ビューで、投資判断や優待戦略を
          自動変更しません。
        </aside>
      </section>
    </main>
  );
}
