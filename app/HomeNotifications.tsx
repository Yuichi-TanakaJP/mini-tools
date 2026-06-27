"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadReadEventIds } from "@/app/tools/disclosure-radar/read-state";
import {
  normalizeSecurityCode,
  selectDisclosureDates,
} from "@/app/tools/disclosure-radar/logic";
import type {
  DisclosureEventItem,
  DisclosureEventsManifest,
  DisclosureEventsResponse,
} from "@/app/tools/disclosure-radar/types";
import type { EarningsCalendarItem } from "@/app/tools/earnings-calendar/types";
import type { EconCalendarEvent } from "@/app/tools/econ-calendar/types";
import { loadItems } from "@/app/tools/my-stocks/storage";

const DISCLOSURE_NOTIFICATION_RANGE_DAYS = 7;
const PREVIEW_ITEM_COUNT = 3;

type DisclosureNotificationData = {
  latestDate: string;
  myStockUnreadItems: DisclosureEventItem[];
  yutaiUnreadItems: DisclosureEventItem[];
};

type EarningsNotificationMarket = {
  count: number;
  items: EarningsCalendarItem[];
};

type EarningsNotificationDay = {
  date: string;
  domestic: EarningsNotificationMarket;
  overseas: EarningsNotificationMarket;
};

type EarningsNotificationResponse = {
  schema_version: "earnings-calendar-home-notifications-v1";
  generated_at: string;
  nikkei225?: {
    as_of_date: string | null;
    codes: string[];
  };
  days: EarningsNotificationDay[];
};

type EarningsNotificationData = {
  days: EarningsNotificationDay[];
  personalItems: Array<{ date: string; item: EarningsCalendarItem }>;
  nikkei225Items: Array<{ date: string; item: EarningsCalendarItem }>;
};

type EconNotificationEvent = EconCalendarEvent & { date: string };

type EconNotificationDay = {
  date: string;
  events: EconNotificationEvent[];
};

type EconNotificationResponse = {
  schema_version: "econ-calendar-home-notifications-v1";
  generated_at: string;
  min_impact: number;
  days: EconNotificationDay[];
};

type EconNotificationData = {
  days: EconNotificationDay[];
  events: EconNotificationEvent[];
};

type NotificationState =
  | { status: "loading" | "empty" }
  | {
      status: "ready";
      disclosure: DisclosureNotificationData | null;
      earnings: EarningsNotificationData | null;
      econ: EconNotificationData | null;
    };

function uniqueAndSortDisclosureItems(items: DisclosureEventItem[]): DisclosureEventItem[] {
  const byId = new Map<string, DisclosureEventItem>();
  for (const item of items) {
    if (!byId.has(item.event_id)) {
      byId.set(item.event_id, item);
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    `${b.disclosure_date} ${b.disclosure_time}`.localeCompare(
      `${a.disclosure_date} ${a.disclosure_time}`,
    ),
  );
}

function uniqueEarningsItems(
  items: Array<{ date: string; item: EarningsCalendarItem }>,
): Array<{ date: string; item: EarningsCalendarItem }> {
  const byKey = new Map<string, { date: string; item: EarningsCalendarItem }>();
  for (const entry of items) {
    const key =
      entry.item.event_id ??
      `${entry.date}-${entry.item.code}-${entry.item.name}-${entry.item.time}`;
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.date} ${a.item.time}`.localeCompare(`${b.date} ${b.item.time}`),
  );
}

function hasDisclosureNotifications(data: DisclosureNotificationData | null) {
  return Boolean(
    data && (data.myStockUnreadItems.length > 0 || data.yutaiUnreadItems.length > 0),
  );
}

function hasEarningsNotifications(data: EarningsNotificationData | null) {
  return Boolean(
    data &&
      (data.personalItems.length > 0 ||
        data.nikkei225Items.length > 0 ||
        data.days.some((day) => day.domestic.count > 0 || day.overseas.count > 0)),
  );
}

function hasEconNotifications(data: EconNotificationData | null) {
  return Boolean(data && data.events.length > 0);
}

function formatDateLabel(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const month = value.getUTCMonth() + 1;
  const day = value.getUTCDate();
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][value.getUTCDay()];
  return `${month}/${day}（${weekday}）`;
}

function DisclosurePreviewList({
  items,
  label,
}: {
  items: DisclosureEventItem[];
  label: string;
}) {
  const previewItems = items.slice(0, PREVIEW_ITEM_COUNT);

  if (previewItems.length === 0) return null;

  return (
    <div className="home-notifications__group">
      <div className="home-notifications__group-title">
        <span>{label}</span>
        <strong>{items.length}件</strong>
      </div>
      <div className="home-notifications__items" aria-label={`${label}の新着の一部`}>
        {previewItems.map((item) => (
          <span key={item.event_id}>
            {normalizeSecurityCode(item.security_code)} {item.company_name}
          </span>
        ))}
      </div>
    </div>
  );
}

function EarningsPreviewList({
  items,
  label,
}: {
  items: Array<{ date: string; item: EarningsCalendarItem }>;
  label: string;
}) {
  const previewItems = items.slice(0, PREVIEW_ITEM_COUNT);

  if (previewItems.length === 0) return null;

  return (
    <div className="home-notifications__group">
      <div className="home-notifications__group-title">
        <span>{label}</span>
        <strong>{items.length}件</strong>
      </div>
      <div className="home-notifications__items" aria-label={`${label}の決算予定の一部`}>
        {previewItems.map(({ date, item }) => (
          <span key={item.event_id ?? `${date}-${item.code}-${item.name}`}>
            {formatDateLabel(date)} {item.code} {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function EarningsDaySummary({ day }: { day: EarningsNotificationDay }) {
  if (day.domestic.count === 0 && day.overseas.count === 0) return null;

  return (
    <div className="home-notifications__day-row">
      <span>{formatDateLabel(day.date)}</span>
      <strong>
        国内 {day.domestic.count}件 / 海外 {day.overseas.count}件
      </strong>
    </div>
  );
}

function EconPreviewList({ events }: { events: EconNotificationEvent[] }) {
  const previewEvents = events.slice(0, PREVIEW_ITEM_COUNT);

  if (previewEvents.length === 0) return null;

  return (
    <div className="home-notifications__group">
      <div className="home-notifications__group-title">
        <span>重要経済指標</span>
        <strong>{events.length}件</strong>
      </div>
      <div className="home-notifications__items" aria-label="重要経済指標の一部">
        {previewEvents.map((event) => (
          <span key={`${event.date}-${event.country_tag ?? event.country ?? ""}-${event.time ?? ""}-${event.indicator_key ?? event.indicator}`}>
            {formatDateLabel(event.date)} {event.time ?? "時刻未定"} {event.country_tag ?? event.country ?? ""} {event.indicator}
          </span>
        ))}
      </div>
    </div>
  );
}

async function loadDisclosureNotifications(
  myStockCodes: Set<string>,
): Promise<DisclosureNotificationData | null> {
  try {
    const manifestResponse = await fetch("/api/disclosure-events/manifest");
    if (!manifestResponse.ok) return null;
    const manifest = (await manifestResponse.json()) as DisclosureEventsManifest;
    const dates = selectDisclosureDates(manifest, DISCLOSURE_NOTIFICATION_RANGE_DAYS);
    if (dates.length === 0) return null;

    const responses = await Promise.all(
      dates.map(async (date) => {
        try {
          const response = await fetch(`/api/disclosure-events/${date}`);
          if (!response.ok) return null;
          return (await response.json()) as DisclosureEventsResponse;
        } catch {
          return null;
        }
      }),
    );
    const readEventIds = loadReadEventIds();
    const unreadItems = responses
      .flatMap((response) => response?.items ?? [])
      .filter((item) => !readEventIds.has(item.event_id));

    return {
      latestDate: manifest.latest,
      yutaiUnreadItems: uniqueAndSortDisclosureItems(
        unreadItems.filter((item) => item.audience === "all"),
      ),
      myStockUnreadItems: uniqueAndSortDisclosureItems(
        unreadItems.filter(
          (item) =>
            item.audience === "personal" &&
            myStockCodes.has(normalizeSecurityCode(item.security_code)),
        ),
      ),
    };
  } catch {
    return null;
  }
}

async function loadEarningsNotifications(
  personalCodes: Set<string>,
): Promise<EarningsNotificationData | null> {
  try {
    const response = await fetch("/api/earnings-calendar/notifications");
    if (!response.ok) return null;
    const payload = (await response.json()) as EarningsNotificationResponse;
    const allItems = payload.days.flatMap((day) =>
      [...day.domestic.items, ...day.overseas.items].map((item) => ({
        date: day.date,
        item,
      })),
    );
    const personalItems = uniqueEarningsItems(
      allItems.filter(({ item }) => personalCodes.has(normalizeSecurityCode(item.code))),
    );
    const nikkei225Codes = new Set(
      (payload.nikkei225?.codes ?? []).map((code) => normalizeSecurityCode(code)),
    );
    const nikkei225Items = uniqueEarningsItems(
      allItems.filter(({ item }) => {
        const code = normalizeSecurityCode(item.code);
        return nikkei225Codes.has(code) && !personalCodes.has(code);
      }),
    );

    return {
      days: payload.days,
      personalItems,
      nikkei225Items,
    };
  } catch {
    return null;
  }
}

async function loadEconNotifications(): Promise<EconNotificationData | null> {
  try {
    const response = await fetch("/api/econ-calendar/notifications");
    if (!response.ok) return null;
    const payload = (await response.json()) as EconNotificationResponse;
    return {
      days: payload.days,
      events: payload.days.flatMap((day) => day.events),
    };
  } catch {
    return null;
  }
}

export default function HomeNotifications() {
  const [state, setState] = useState<NotificationState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      const myStockCodes = new Set(
        loadItems().map((item) => normalizeSecurityCode(item.code)),
      );
      const [disclosure, earnings, econ] = await Promise.all([
        loadDisclosureNotifications(myStockCodes),
        loadEarningsNotifications(myStockCodes),
        loadEconNotifications(),
      ]);

      if (!active) return;
      setState(
        hasDisclosureNotifications(disclosure) ||
          hasEarningsNotifications(earnings) ||
          hasEconNotifications(econ)
          ? { status: "ready", disclosure, earnings, econ }
          : { status: "empty" },
      );
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, []);

  const notificationCount = useMemo(() => {
    if (state.status !== "ready") return 0;
    const disclosureCount = state.disclosure
      ? state.disclosure.myStockUnreadItems.length + state.disclosure.yutaiUnreadItems.length
      : 0;
    const earningsEventCount = state.earnings
      ? state.earnings.days.reduce(
          (sum, day) => sum + day.domestic.count + day.overseas.count,
          0,
        )
      : 0;
    const econEventCount = state.econ?.events.length ?? 0;
    return disclosureCount + earningsEventCount + econEventCount;
  }, [state]);

  if (state.status !== "ready") return null;

  const { disclosure, earnings, econ } = state;

  return (
    <section className="home-notifications" aria-label="通知" aria-live="polite">
      <div className="home-notifications__header">
        <div>
          <p className="home-notifications__eyebrow">NOTIFICATIONS</p>
          <h2>開示・決算の注目イベント</h2>
        </div>
        <span className="home-notifications__count">注目 {notificationCount}件</span>
      </div>

      <p className="home-notifications__summary">
        開示イベントの未確認と、保有/ウォッチ・日経225を含む今日・明日の決算予定、重要経済指標をホームでまとめて確認できます。
        {disclosure ? ` 開示データ: ${disclosure.latestDate}` : ""}
      </p>

      <div className="home-notifications__groups">
        {earnings && hasEarningsNotifications(earnings) ? (
          <div className="home-notifications__group home-notifications__group--earnings">
            <div className="home-notifications__group-title">
              <span>今日・明日の決算予定</span>
              <strong>2日分</strong>
            </div>
            <div className="home-notifications__day-list">
              {earnings.days.map((day) => (
                <EarningsDaySummary key={day.date} day={day} />
              ))}
            </div>
          </div>
        ) : null}
        {earnings ? (
          <>
            <EarningsPreviewList items={earnings.personalItems} label="決算: 保有/ウォッチ" />
            <EarningsPreviewList items={earnings.nikkei225Items} label="決算: 日経225" />
          </>
        ) : null}
        {econ ? <EconPreviewList events={econ.events} /> : null}
        {disclosure ? (
          <>
            <DisclosurePreviewList items={disclosure.myStockUnreadItems} label="開示: マイ銘柄" />
            <DisclosurePreviewList items={disclosure.yutaiUnreadItems} label="開示: 優待変更" />
          </>
        ) : null}
      </div>

      <div className="home-notifications__links">
        {earnings && hasEarningsNotifications(earnings) ? (
          <Link className="home-notifications__link" href="/tools/earnings-calendar">
            決算カレンダーで確認する
          </Link>
        ) : null}
        {econ && hasEconNotifications(econ) ? (
          <Link
            className="home-notifications__link home-notifications__link--secondary"
            href="/tools/econ-calendar"
          >
            経済指標を見る
          </Link>
        ) : null}
        {disclosure?.myStockUnreadItems.length ? (
          <Link
            className="home-notifications__link home-notifications__link--secondary"
            href="/tools/disclosure-radar?view=my-stocks&range=7"
          >
            マイ銘柄の開示を見る
          </Link>
        ) : null}
        {disclosure?.yutaiUnreadItems.length ? (
          <Link
            className="home-notifications__link home-notifications__link--secondary"
            href="/tools/disclosure-radar?view=yutai&range=7"
          >
            優待変更を見る
          </Link>
        ) : null}
      </div>

      <style>{`
        .home-notifications {
          border: 1px solid var(--color-border);
          border-radius: 16px;
          background: linear-gradient(180deg, var(--color-bg-card) 0%, var(--color-bg-input) 100%);
          box-shadow: 0 8px 24px rgba(15,23,42,0.06);
          margin: 0 0 28px;
          padding: 18px;
        }

        .home-notifications__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 10px;
        }

        .home-notifications__eyebrow {
          margin: 0 0 4px;
          color: var(--color-accent);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .home-notifications h2 {
          margin: 0;
          color: var(--color-text);
          font-size: 18px;
          line-height: 1.35;
          letter-spacing: 0;
        }

        .home-notifications__count {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: var(--color-accent);
          color: #fff;
          font-size: 12px;
          font-weight: 900;
          padding: 5px 10px;
        }

        .home-notifications__summary {
          margin: 0 0 14px;
          color: var(--color-text-sub);
          font-size: 13px;
          line-height: 1.65;
        }

        .home-notifications__groups {
          display: grid;
          gap: 12px;
          margin-bottom: 14px;
        }

        .home-notifications__group {
          min-width: 0;
        }

        .home-notifications__group--earnings {
          border: 1px solid var(--color-border);
          border-radius: 12px;
          background: var(--color-bg-card);
          padding: 10px 12px;
        }

        .home-notifications__group-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          color: var(--color-text-sub);
          font-size: 12px;
          font-weight: 900;
        }

        .home-notifications__group-title strong {
          color: var(--color-accent);
          font-size: 12px;
        }

        .home-notifications__day-list {
          display: grid;
          gap: 6px;
        }

        .home-notifications__day-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: var(--color-text-sub);
          font-size: 12px;
          line-height: 1.5;
        }

        .home-notifications__day-row strong {
          color: var(--color-text);
          font-size: 12px;
          text-align: right;
        }

        .home-notifications__items {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .home-notifications__items span {
          border: 1px solid var(--color-border-strong);
          border-radius: 999px;
          background: var(--color-bg-card);
          color: var(--color-text-sub);
          font-size: 12px;
          font-weight: 700;
          padding: 5px 9px;
        }

        .home-notifications__links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .home-notifications__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          border-radius: 8px;
          background: var(--color-accent);
          color: #fff;
          font-size: 13px;
          font-weight: 900;
          padding: 8px 13px;
          text-decoration: none;
        }

        .home-notifications__link--secondary {
          background: var(--color-bg-card);
          color: var(--color-accent);
          border: 1px solid var(--color-border-strong);
        }

        @media (max-width: 560px) {
          .home-notifications {
            padding: 16px;
          }

          .home-notifications__header,
          .home-notifications__day-row {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }

          .home-notifications__day-row strong {
            text-align: left;
          }

          .home-notifications__count,
          .home-notifications__link {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}