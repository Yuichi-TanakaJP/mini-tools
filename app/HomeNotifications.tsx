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
import { loadItems } from "@/app/tools/my-stocks/storage";

const NOTIFICATION_RANGE_DAYS = 7;
const PREVIEW_ITEM_COUNT = 3;

type NotificationState =
  | { status: "loading" | "empty" | "error" }
  | {
      status: "ready";
      latestDate: string;
      myStockUnreadItems: DisclosureEventItem[];
      yutaiUnreadItems: DisclosureEventItem[];
    };

function uniqueAndSort(items: DisclosureEventItem[]): DisclosureEventItem[] {
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

function EventPreviewList({
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

export default function HomeNotifications() {
  const [state, setState] = useState<NotificationState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const manifestResponse = await fetch("/api/disclosure-events/manifest");
        if (!manifestResponse.ok) throw new Error(`manifest: ${manifestResponse.status}`);
        const manifest = (await manifestResponse.json()) as DisclosureEventsManifest;
        const dates = selectDisclosureDates(manifest, NOTIFICATION_RANGE_DAYS);
        if (dates.length === 0) {
          if (active) setState({ status: "empty" });
          return;
        }

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
        const myStockCodes = new Set(
          loadItems().map((item) => normalizeSecurityCode(item.code)),
        );
        const unreadItems = responses
          .flatMap((response) => response?.items ?? [])
          .filter((item) => !readEventIds.has(item.event_id));
        const yutaiUnreadItems = uniqueAndSort(
          unreadItems.filter((item) => item.audience === "all"),
        );
        const myStockUnreadItems = uniqueAndSort(
          unreadItems.filter(
            (item) =>
              item.audience === "personal" &&
              myStockCodes.has(normalizeSecurityCode(item.security_code)),
          ),
        );

        if (!active) return;
        setState(
          yutaiUnreadItems.length > 0 || myStockUnreadItems.length > 0
            ? {
                status: "ready",
                latestDate: manifest.latest,
                myStockUnreadItems,
                yutaiUnreadItems,
              }
            : { status: "empty" },
        );
      } catch {
        if (active) setState({ status: "error" });
      }
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, []);

  const totalUnreadCount = useMemo(
    () =>
      state.status === "ready"
        ? state.yutaiUnreadItems.length + state.myStockUnreadItems.length
        : 0,
    [state],
  );

  if (state.status !== "ready") return null;

  return (
    <section className="home-notifications" aria-label="通知" aria-live="polite">
      <div className="home-notifications__header">
        <div>
          <p className="home-notifications__eyebrow">NOTIFICATIONS</p>
          <h2>開示イベントの新着があります</h2>
        </div>
        <span className="home-notifications__count">未確認 {totalUnreadCount}件</span>
      </div>

      <p className="home-notifications__summary">
        直近{NOTIFICATION_RANGE_DAYS}日間の優待変更とマイ銘柄関連の開示を確認できます。
        最新データ: {state.latestDate}
      </p>

      <div className="home-notifications__groups">
        <EventPreviewList items={state.myStockUnreadItems} label="マイ銘柄" />
        <EventPreviewList items={state.yutaiUnreadItems} label="優待変更" />
      </div>

      <div className="home-notifications__links">
        {state.myStockUnreadItems.length > 0 ? (
          <Link
            className="home-notifications__link"
            href="/tools/disclosure-radar?view=my-stocks&range=7"
          >
            マイ銘柄の開示を見る
          </Link>
        ) : null}
        {state.yutaiUnreadItems.length > 0 ? (
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

          .home-notifications__header {
            flex-direction: column;
            gap: 10px;
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
