"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadItems } from "@/app/tools/my-stocks/storage";
import { filterDisclosureEvents, normalizeSecurityCode, type RadarView } from "./logic";
import type { DisclosureEventItem, DisclosureEventType, DisclosureEventsResponse } from "./types";
import styles from "./ToolClient.module.css";

const EVENT_LABELS: Record<DisclosureEventType, string> = {
  yutai_new: "優待新設",
  yutai_expand: "優待拡充",
  yutai_change: "優待変更",
  yutai_end: "優待廃止",
  yutai_review: "優待要確認",
  dividend_increase: "増配・復配",
  dividend_decrease: "減配・無配",
  dividend_change: "配当変更",
  performance_revision: "業績修正",
  share_buyback: "自社株買い",
  ma_reorganization: "M&A・再編",
  governance: "人事・ガバナンス",
  correction: "訂正",
};

function EventCard({ item }: { item: DisclosureEventItem }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={`${styles.badge} ${styles[item.priority]}`}>
          {EVENT_LABELS[item.event_type]}
        </span>
        <span className={styles.time}>{item.disclosure_time}</span>
      </div>
      <div className={styles.company}>
        <span>{normalizeSecurityCode(item.security_code)}</span>
        <strong>{item.company_name}</strong>
      </div>
      <p className={styles.title}>{item.title}</p>
      <div className={styles.cardFooter}>
        {item.needs_review ? <span className={styles.review}>要確認</span> : <span />}
        {item.source_url ? (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer">
            開示を見る
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function ToolClient({
  data,
  initialView,
}: {
  data: DisclosureEventsResponse | null;
  initialView: RadarView;
}) {
  const [view, setView] = useState<RadarView>(initialView);
  const [query, setQuery] = useState("");
  const [myStockCodes] = useState<Set<string>>(
    () => new Set(loadItems().map((item) => normalizeSecurityCode(item.code))),
  );

  const filteredItems = useMemo(
    () => filterDisclosureEvents(data?.items ?? [], view, myStockCodes, query),
    [data?.items, myStockCodes, query, view],
  );

  const yutaiCount = data?.items.filter((item) => item.audience === "all").length ?? 0;
  const personalCount =
    data?.items.filter(
      (item) =>
        item.audience === "personal" &&
        myStockCodes.has(normalizeSecurityCode(item.security_code)),
    ).length ?? 0;

  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>TDNET EVENT RADAR</p>
          <h1>開示イベントレーダー</h1>
          <p>
            優待変更は全銘柄から、配当・業績修正などは端末内のマイ銘柄から拾います。
          </p>
        </div>
        {data ? <span className={styles.date}>{data.target_date}</span> : null}
      </header>

      <div className={styles.tabs} role="tablist" aria-label="表示対象">
        <button
          type="button"
          role="tab"
          aria-selected={view === "yutai"}
          className={view === "yutai" ? styles.tabActive : styles.tab}
          onClick={() => setView("yutai")}
        >
          優待変更 <span>{yutaiCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "my-stocks"}
          className={view === "my-stocks" ? styles.tabActive : styles.tab}
          onClick={() => setView("my-stocks")}
        >
          マイ銘柄 <span>{personalCount}</span>
        </button>
      </div>

      <input
        className={styles.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="銘柄コード・会社名・タイトルで検索"
        aria-label="イベント検索"
      />

      {!data ? (
        <section className={styles.empty}>
          開示イベントを取得できませんでした。API設定または通信状況を確認してください。
        </section>
      ) : filteredItems.length > 0 ? (
        <section className={styles.grid}>
          {filteredItems.map((item) => (
            <EventCard key={item.event_id} item={item} />
          ))}
        </section>
      ) : (
        <section className={styles.empty}>
          <p>該当する開示イベントはありません。</p>
          {view === "my-stocks" && myStockCodes.size === 0 ? (
            <Link href="/tools/my-stocks">マイ銘柄を登録する</Link>
          ) : null}
        </section>
      )}

      <p className={styles.note}>
        マイ銘柄との照合はブラウザ内で行います。登録銘柄コードはサーバーへ送信しません。
      </p>
    </main>
  );
}
