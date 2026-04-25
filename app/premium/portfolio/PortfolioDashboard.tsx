"use client";

import { useMemo, useState } from "react";
import type { PortfolioEvent, PortfolioHolding } from "./sample-data";

type Props = {
  holdings: PortfolioHolding[];
  events: PortfolioEvent[];
  today: string;
};

type SortKey = "value" | "profit" | "yield" | "event";

const toneColor = {
  earnings: { bg: "#eff6ff", fg: "#1d4ed8", label: "決算" },
  dividend: { bg: "#f0fdf4", fg: "#166534", label: "配当" },
  benefit: { bg: "#fff7ed", fg: "#c2410c", label: "優待" },
  price: { bg: "#f8fafc", fg: "#334155", label: "価格" },
} as const;

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function formatNumber(value: number, fractionDigits = 1) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}/${month}/${day}`;
}

function getDaysUntil(date: string, today: string) {
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const todayStart = new Date(todayYear, todayMonth - 1, todayDay);
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  return Math.ceil((target.getTime() - todayStart.getTime()) / 86_400_000);
}

function getMarketValue(holding: PortfolioHolding) {
  return holding.shares * holding.currentPrice;
}

function getCostValue(holding: PortfolioHolding) {
  return holding.shares * holding.averagePrice;
}

function getProfit(holding: PortfolioHolding) {
  return getMarketValue(holding) - getCostValue(holding);
}

function getDividendYield(holding: PortfolioHolding) {
  return (holding.dividendPerShare / holding.currentPrice) * 100;
}

function getAllocationColor(index: number) {
  const colors = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
  return colors[index % colors.length];
}

function SummaryTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "blue" | "green" | "orange" | "slate";
}) {
  const toneMap = {
    blue: { bg: "#eff6ff", border: "#bfdbfe", fg: "#1d4ed8" },
    green: { bg: "#f0fdf4", border: "#bbf7d0", fg: "#166534" },
    orange: { bg: "#fff7ed", border: "#fdba74", fg: "#c2410c" },
    slate: { bg: "#f8fafc", border: "#cbd5e1", fg: "#334155" },
  } as const;

  return (
    <section
      style={{
        background: toneMap[tone].bg,
        border: `1px solid ${toneMap[tone].border}`,
        borderRadius: 8,
        padding: "16px",
        minHeight: 128,
      }}
    >
      <div style={{ color: toneMap[tone].fg, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ color: toneMap[tone].fg, fontSize: 24, fontWeight: 900, marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ color: toneMap[tone].fg, fontSize: 12, lineHeight: 1.6 }}>{sub}</div>
    </section>
  );
}

export default function PortfolioDashboard({ holdings, events, today }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("event");

  const summary = useMemo(() => {
    const totalValue = holdings.reduce((sum, item) => sum + getMarketValue(item), 0);
    const totalCost = holdings.reduce((sum, item) => sum + getCostValue(item), 0);
    const annualDividend = holdings.reduce(
      (sum, item) => sum + item.dividendPerShare * item.shares,
      0
    );
    const benefits = holdings.filter((item) => item.benefitSummary).length;
    const nextEvent = events
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((event) => getDaysUntil(event.date, today) >= 0);

    return {
      totalValue,
      totalProfit: totalValue - totalCost,
      annualDividend,
      portfolioYield: totalValue > 0 ? (annualDividend / totalValue) * 100 : 0,
      benefits,
      nextEvent,
    };
  }, [events, holdings, today]);

  const sortedHoldings = useMemo(() => {
    return holdings.slice().sort((a, b) => {
      if (sortKey === "profit") return getProfit(b) - getProfit(a);
      if (sortKey === "yield") return getDividendYield(b) - getDividendYield(a);
      if (sortKey === "event") return a.nextEarningsDate.localeCompare(b.nextEarningsDate);
      return getMarketValue(b) - getMarketValue(a);
    });
  }, [holdings, sortKey]);

  const allocation = useMemo(() => {
    const total = summary.totalValue || 1;
    return holdings
      .map((holding) => ({
        code: holding.code,
        name: holding.name,
        value: getMarketValue(holding),
        percent: (getMarketValue(holding) / total) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, summary.totalValue]);

  const upcomingEvents = events
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((event) => getDaysUntil(event.date, today) >= -7)
    .slice(0, 6);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section
        style={{
          background: "#102033",
          color: "#fff",
          borderRadius: 8,
          padding: "24px 20px",
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#93c5fd", marginBottom: 8 }}>
              Premium Portfolio
            </div>
            <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15, letterSpacing: 0 }}>
              My Stocks Dashboard
            </h1>
          </div>
          <div
            style={{
              alignSelf: "start",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "rgba(255,255,255,0.82)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            sample data
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", marginBottom: 6 }}>
              評価額
            </div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{formatYen(summary.totalValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", marginBottom: 6 }}>
              含み損益
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: summary.totalProfit >= 0 ? "#86efac" : "#fca5a5",
              }}
            >
              {summary.totalProfit >= 0 ? "+" : ""}
              {formatYen(summary.totalProfit)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", marginBottom: 6 }}>
              年間配当見込み
            </div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{formatYen(summary.annualDividend)}</div>
          </div>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <SummaryTile
          label="配当利回り"
          value={`${formatNumber(summary.portfolioYield, 2)}%`}
          sub="保有評価額に対する年間配当見込み"
          tone="green"
        />
        <SummaryTile
          label="次のイベント"
          value={summary.nextEvent ? formatDate(summary.nextEvent.date) : "-"}
          sub={summary.nextEvent ? `${summary.nextEvent.code} ${summary.nextEvent.title}` : "予定なし"}
          tone="blue"
        />
        <SummaryTile
          label="優待つき保有"
          value={`${summary.benefits}銘柄`}
          sub="優待条件や期限を保有状況と並べて確認"
          tone="orange"
        />
        <SummaryTile
          label="保有銘柄"
          value={`${holdings.length}銘柄`}
          sub="保有状況と確認日を同じ画面で集約"
          tone="slate"
        />
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>保有銘柄</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["event", "イベント順"],
                ["value", "評価額順"],
                ["profit", "損益順"],
                ["yield", "利回り順"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortKey(key as SortKey)}
                  style={{
                    height: 34,
                    borderRadius: 8,
                    border: sortKey === key ? "1px solid #2563eb" : "1px solid var(--color-border)",
                    background: sortKey === key ? "#eff6ff" : "#fff",
                    color: sortKey === key ? "#1d4ed8" : "var(--color-text-sub)",
                    fontWeight: 800,
                    fontSize: 12,
                    padding: "0 10px",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
              <thead>
                <tr style={{ color: "var(--color-text-muted)", fontSize: 12, textAlign: "left" }}>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-border)" }}>銘柄</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-border)" }}>保有</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-border)" }}>評価額</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-border)" }}>損益</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-border)" }}>配当</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-border)" }}>次回決算</th>
                  <th style={{ padding: "10px 8px", borderBottom: "1px solid var(--color-border)" }}>メモ</th>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((holding) => {
                  const profit = getProfit(holding);
                  return (
                    <tr key={holding.code} style={{ verticalAlign: "top" }}>
                      <td style={{ padding: "14px 8px", borderBottom: "1px solid var(--color-border)" }}>
                        <div style={{ fontWeight: 900 }}>{holding.code}</div>
                        <div style={{ fontSize: 13, color: "var(--color-text-sub)", marginTop: 3 }}>
                          {holding.name}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {holding.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                borderRadius: 999,
                                background: "#f1f5f9",
                                color: "#475569",
                                fontSize: 11,
                                fontWeight: 800,
                                padding: "4px 7px",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "14px 8px", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
                        <div>{holding.shares.toLocaleString("ja-JP")}株</div>
                        <div style={{ color: "var(--color-text-muted)", marginTop: 4 }}>
                          平均 {formatPrice(holding.averagePrice)}
                        </div>
                      </td>
                      <td style={{ padding: "14px 8px", borderBottom: "1px solid var(--color-border)", fontWeight: 800 }}>
                        {formatYen(getMarketValue(holding))}
                      </td>
                      <td style={{ padding: "14px 8px", borderBottom: "1px solid var(--color-border)" }}>
                        <div style={{ color: profit >= 0 ? "#166534" : "#991b1b", fontWeight: 900 }}>
                          {profit >= 0 ? "+" : ""}
                          {formatYen(profit)}
                        </div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>
                          現在 {formatPrice(holding.currentPrice)}
                        </div>
                      </td>
                      <td style={{ padding: "14px 8px", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
                        <div style={{ fontWeight: 900 }}>{formatNumber(getDividendYield(holding), 2)}%</div>
                        <div style={{ color: "var(--color-text-muted)", marginTop: 4 }}>
                          年 {formatYen(holding.dividendPerShare * holding.shares)}
                        </div>
                      </td>
                      <td style={{ padding: "14px 8px", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
                        {formatDate(holding.nextEarningsDate)}
                        <div style={{ color: "var(--color-text-muted)", marginTop: 4 }}>
                          あと{Math.max(0, getDaysUntil(holding.nextEarningsDate, today))}日
                        </div>
                      </td>
                      <td style={{ padding: "14px 8px", borderBottom: "1px solid var(--color-border)", fontSize: 13, lineHeight: 1.6 }}>
                        {holding.memo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>直近イベント</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {upcomingEvents.map((event) => {
                const tone = toneColor[event.kind];
                return (
                  <div
                    key={`${event.date}-${event.code}-${event.title}`}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: 12,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 900 }}>{formatDate(event.date)}</span>
                      <span
                        style={{
                          background: tone.bg,
                          color: tone.fg,
                          borderRadius: 999,
                          padding: "3px 7px",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {tone.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-text-sub)", lineHeight: 1.6 }}>
                      {event.code} {event.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>配分</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {allocation.map((item, index) => (
                <div key={item.code}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 5 }}>
                    <span style={{ fontWeight: 800 }}>{item.code} {item.name}</span>
                    <span style={{ color: "var(--color-text-muted)" }}>{formatNumber(item.percent, 1)}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${item.percent}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: getAllocationColor(index),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
