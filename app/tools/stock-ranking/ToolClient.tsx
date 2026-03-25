"use client";

import { useEffect, useMemo, useState } from "react";
import type { RankingDayData, RankingPageData, RankingMarket, RankingType, RankingRecord } from "./types";

const MARKETS: RankingMarket[] = ["プライム", "スタンダード", "グロース"];
const RANKINGS: RankingType[] = ["値上がり率", "値下がり率", "売買高"];

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function sign(n: number) {
  return n > 0 ? "+" : "";
}

function fmtRate(n: number) {
  return `${sign(n)}${n.toFixed(2)}%`;
}

function fmtPrice(n: number) {
  return n.toLocaleString("ja-JP");
}

function fmtVolume(n: number) {
  return `${n.toLocaleString("ja-JP")}万株`;
}

function fmtValue(n: number) {
  return `${(n / 100).toFixed(1)}億円`;
}

type TabBarProps = {
  options: string[];
  value: string;
  onChange: (v: string) => void;
};

function TabBar({ options, value, onChange }: TabBarProps) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: active
                ? "1.5px solid var(--color-accent)"
                : "1.5px solid var(--color-border-strong)",
              background: active ? "var(--color-accent-sub)" : "var(--color-bg-card)",
              color: active ? "var(--color-accent)" : "var(--color-text-sub)",
              fontWeight: active ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

type RankingTableProps = {
  records: RankingRecord[];
  rankingType: RankingType;
};

function RankingTable({ records, rankingType }: RankingTableProps) {
  const showVolume = rankingType === "売買高";

  const cols: { key: string; label: string; align: "left" | "right" }[] = [
    { key: "rank", label: "順位", align: "right" },
    { key: "name", label: "銘柄", align: "left" },
    { key: "industry", label: "業種", align: "left" },
    { key: "price", label: "現在値", align: "right" },
    { key: "change", label: "前日比", align: "right" },
    { key: "changeRate", label: "騰落率", align: "right" },
    showVolume
      ? { key: "volume", label: "売買高(万株)", align: "right" }
      : { key: "value", label: "売買代金(億円)", align: "right" },
  ];

  if (records.length === 0) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
        データがありません
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--color-border-strong)" }}>
            {cols.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "8px 10px",
                  textAlign: col.align,
                  fontWeight: 700,
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  letterSpacing: 0.3,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const up = r.changeRate > 0;
            const down = r.changeRate < 0;
            const rateColor = up
              ? "var(--color-error)"
              : down
              ? "#2563eb"
              : "var(--color-text-muted)";

            return (
              <tr
                key={`${r.code}-${r.rank}`}
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                {/* 順位 */}
                <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--color-text-muted)", fontWeight: 600, width: 44 }}>
                  {r.rank}
                </td>
                {/* 銘柄 */}
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 1 }}>{r.code}</div>
                </td>
                {/* 業種 */}
                <td style={{ padding: "8px 10px", color: "var(--color-text-sub)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {r.industry}
                </td>
                {/* 現在値 */}
                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {fmtPrice(r.price)}
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 2 }}>円</span>
                </td>
                {/* 前日比 */}
                <td style={{ padding: "8px 10px", textAlign: "right", color: rateColor, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {sign(r.change)}{fmtPrice(r.change)}
                </td>
                {/* 騰落率 */}
                <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: up ? "#fee2e2" : down ? "#dbeafe" : "var(--color-bg-input)",
                    color: rateColor,
                    fontWeight: 700,
                    fontSize: 12,
                  }}>
                    {fmtRate(r.changeRate)}
                  </span>
                </td>
                {/* 売買高 or 売買代金 */}
                {showVolume ? (
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--color-text-sub)", whiteSpace: "nowrap" }}>
                    {fmtVolume(r.volume)}
                  </td>
                ) : (
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--color-text-sub)", whiteSpace: "nowrap" }}>
                    {fmtValue(r.value)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ToolClient({ data }: { data: RankingPageData }) {
  const { manifest, initialDayData } = data;

  const [selectedDate, setSelectedDate] = useState<string>(manifest.latest);
  const [selectedMarket, setSelectedMarket] = useState<RankingMarket>("プライム");
  const [selectedRanking, setSelectedRanking] = useState<RankingType>("値上がり率");
  const [loadedDays, setLoadedDays] = useState<Record<string, RankingDayData>>(() => {
    if (!initialDayData) return {};
    return { [initialDayData.date]: initialDayData };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (loadedDays[selectedDate]) {
      setLoadError(null);
      return;
    }

    let active = true;

    async function loadSelectedDate() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(`/tools/stock-ranking/data/${selectedDate}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const day = (await res.json()) as RankingDayData;
        if (!active) return;
        setLoadedDays((current) => ({ ...current, [day.date]: day }));
      } catch {
        if (!active) return;
        setLoadError("データを読み込めませんでした。時間をおいて再度お試しください。");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSelectedDate();

    return () => {
      active = false;
    };
  }, [loadedDays, selectedDate]);

  const filtered = useMemo<RankingRecord[]>(() => {
    const day = loadedDays[selectedDate];
    if (!day) return [];
    return day.records.filter(
      (r) => r.market === selectedMarket && r.ranking === selectedRanking,
    );
  }, [loadedDays, selectedDate, selectedMarket, selectedRanking]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 64px" }}>
      {/* ヘッダー */}
      <section style={{ padding: "32px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 26 }}>📊</span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>
            株価ランキング
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
          プライム・スタンダード・グロース市場の値上がり率・値下がり率・売買高ランキング。
        </p>
      </section>

      {/* コントロール */}
      <div style={{
        background: "var(--color-bg-card)",
        borderRadius: 14,
        border: "1px solid var(--color-border)",
        padding: "16px 18px",
        marginBottom: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        {/* 日付 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", minWidth: 40 }}>
            日付
          </span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1.5px solid var(--color-border-strong)",
              background: "var(--color-bg-input)",
              fontSize: 13,
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            {manifest.dates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </select>
        </div>

        {/* 市場 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", minWidth: 40 }}>
            市場
          </span>
          <TabBar
            options={MARKETS}
            value={selectedMarket}
            onChange={(v) => setSelectedMarket(v as RankingMarket)}
          />
        </div>

        {/* ランキング種別 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", minWidth: 40 }}>
            種別
          </span>
          <TabBar
            options={RANKINGS}
            value={selectedRanking}
            onChange={(v) => setSelectedRanking(v as RankingType)}
          />
        </div>
      </div>

      {/* 件数バッジ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-sub)" }}>
          {selectedMarket} — {selectedRanking}
        </span>
        <span style={{
          padding: "2px 8px",
          borderRadius: 999,
          background: "var(--color-accent-sub)",
          color: "var(--color-accent)",
          fontSize: 11,
          fontWeight: 800,
        }}>
          {filtered.length}件
        </span>
      </div>

      {/* テーブル */}
      <div style={{
        background: "var(--color-bg-card)",
        borderRadius: 14,
        border: "1px solid var(--color-border)",
        overflow: "hidden",
      }}>
        {loadError ? (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
            {loadError}
          </div>
        ) : isLoading && !loadedDays[selectedDate] ? (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
            読み込み中...
          </div>
        ) : (
        <RankingTable records={filtered} rankingType={selectedRanking} />
        )}
      </div>

      {/* データ注記 */}
      <p style={{ marginTop: 16, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
        ※ データは内藤証券のランキング情報をもとに加工・整形したものです。投資判断の参考情報としてご利用ください。
      </p>
    </main>
  );
}
