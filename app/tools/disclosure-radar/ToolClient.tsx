"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadItems } from "@/app/tools/my-stocks/storage";
import {
  filterDisclosureEvents,
  normalizeSecurityCode,
  type RadarView,
  type RangeDays,
  type TopicFilter,
} from "./logic";
import type {
  DisclosureEventItem,
  DisclosureEventType,
  DisclosureEventsPageData,
} from "./types";
import styles from "./ToolClient.module.css";

const READ_KEY = "disclosure_radar_read_event_ids_v1";

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

const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 1, label: "直近1日" },
  { value: 7, label: "7日" },
  { value: 30, label: "30日" },
];

const YUTAI_TOPICS: { value: TopicFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "important", label: "重要" },
  { value: "new-expand", label: "新設・拡充" },
  { value: "change-end", label: "変更・廃止" },
];

const PERSONAL_TOPICS: { value: TopicFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "important", label: "重要" },
  { value: "dividend", label: "配当" },
  { value: "performance", label: "業績" },
  { value: "capital", label: "資本施策" },
  { value: "other", label: "その他" },
];

function loadReadEventIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function saveReadEventIds(ids: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids).slice(-2000)));
  } catch {
    // The in-memory state remains usable when storage is unavailable.
  }
}

function EventCard({
  item,
  isRead,
  focused,
  onReadChange,
}: {
  item: DisclosureEventItem;
  isRead: boolean;
  focused: boolean;
  onReadChange: (eventId: string, read: boolean) => void;
}) {
  return (
    <article
      id={`event-${item.event_id}`}
      className={`${styles.card} ${isRead ? styles.cardRead : ""} ${
        focused ? styles.cardFocused : ""
      }`}
    >
      <div className={styles.cardHeader}>
        <div className={styles.badgeRow}>
          {!isRead ? <span className={styles.unread}>未確認</span> : null}
          <span className={`${styles.badge} ${styles[item.priority]}`}>
            {EVENT_LABELS[item.event_type]}
          </span>
        </div>
        <span className={styles.time}>
          {item.disclosure_date.slice(5).replace("-", "/")} {item.disclosure_time}
        </span>
      </div>
      <div className={styles.company}>
        <span>{normalizeSecurityCode(item.security_code)}</span>
        <strong>{item.company_name}</strong>
      </div>
      <p className={styles.title}>{item.title}</p>
      <div className={styles.cardFooter}>
        <div>
          {item.needs_review ? <span className={styles.review}>要確認</span> : null}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => onReadChange(item.event_id, !isRead)}
          >
            {isRead ? "未確認に戻す" : "確認済みにする"}
          </button>
          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onReadChange(item.event_id, true)}
            >
              開示を見る
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function ToolClient({
  data,
  initialView,
  initialRange,
  initialEventId,
}: {
  data: DisclosureEventsPageData | null;
  initialView: RadarView;
  initialRange: RangeDays;
  initialEventId?: string;
}) {
  const [view, setView] = useState<RadarView>(initialView);
  const [rangeDays, setRangeDays] = useState<RangeDays>(initialRange);
  const [topic, setTopic] = useState<TopicFilter>("all");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [readEventIds, setReadEventIds] = useState<Set<string>>(loadReadEventIds);
  const [myStockCodes] = useState<Set<string>>(
    () => {
      const codes = new Set(
        loadItems().map((item) => normalizeSecurityCode(item.code)),
      );
      const target = data?.items.find((item) => item.event_id === initialEventId);
      if (target?.audience === "personal") {
        codes.add(normalizeSecurityCode(target.security_code));
      }
      return codes;
    },
  );

  useEffect(() => {
    if (!initialEventId) return;
    document
      .getElementById(`event-${initialEventId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [initialEventId]);

  const filterItems = (
    targetView: RadarView,
    targetTopic: TopicFilter,
    targetUnreadOnly: boolean,
  ) =>
    filterDisclosureEvents(
      data?.items ?? [],
      targetView,
      myStockCodes,
      query,
      rangeDays,
      rangeDays === 1 ? data?.latestDate ?? "" : data?.referenceDate ?? "",
      targetTopic,
      targetUnreadOnly,
      readEventIds,
    );

  const filteredItems = useMemo(
    () => filterItems(view, topic, unreadOnly),
    // filterItems closes over all listed values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, myStockCodes, query, rangeDays, readEventIds, topic, unreadOnly, view],
  );
  const yutaiCount = filterItems("yutai", "all", false).length;
  const personalCount = filterItems("my-stocks", "all", false).length;
  const unreadCount = filterItems(view, topic, true).length;
  const topicOptions = view === "yutai" ? YUTAI_TOPICS : PERSONAL_TOPICS;

  function changeView(nextView: RadarView) {
    setView(nextView);
    setTopic("all");
  }

  function changeReadState(eventId: string, read: boolean) {
    setReadEventIds((current) => {
      const next = new Set(current);
      if (read) next.add(eventId);
      else next.delete(eventId);
      saveReadEventIds(next);
      return next;
    });
  }

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
        {data ? (
          <span className={styles.date}>最新 {data.latestDate}</span>
        ) : null}
      </header>

      <div className={styles.tabs} role="tablist" aria-label="表示対象">
        <button
          type="button"
          role="tab"
          aria-selected={view === "yutai"}
          className={view === "yutai" ? styles.tabActive : styles.tab}
          onClick={() => changeView("yutai")}
        >
          優待変更 <span>{yutaiCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "my-stocks"}
          className={view === "my-stocks" ? styles.tabActive : styles.tab}
          onClick={() => changeView("my-stocks")}
        >
          マイ銘柄 <span>{personalCount}</span>
        </button>
      </div>

      <section className={styles.controls} aria-label="表示条件">
        <div className={styles.chips}>
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={rangeDays === option.value ? styles.chipActive : styles.chip}
              onClick={() => setRangeDays(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={styles.chips}>
          {topicOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={topic === option.value ? styles.chipActive : styles.chip}
              onClick={() => setTopic(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className={styles.unreadToggle}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          未確認のみ
          <span>{unreadCount}</span>
        </label>
      </section>

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
            <EventCard
              key={item.event_id}
              item={item}
              isRead={readEventIds.has(item.event_id)}
              focused={initialEventId === item.event_id}
              onReadChange={changeReadState}
            />
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
        確認済み状態とマイ銘柄との照合はブラウザ内で行います。登録内容はサーバーへ送信しません。
      </p>
    </main>
  );
}
