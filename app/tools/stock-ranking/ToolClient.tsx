"use client";

import { useMemo, useState } from "react";
import type { RankingDayData, RankingManifest, RankingMarket, RankingType, RankingRecord } from "./types";
import LoadingSpinner from "@/components/LoadingSpinner";
import TabBar from "@/app/tools/_shared/TabBar";
import { formatToolDate, signPrefix } from "@/app/tools/_shared/tool-client-format";
import { useDailyMarketData } from "@/app/tools/_shared/use-daily-market-data";

const MARKETS: RankingMarket[] = ["プライム", "スタンダード", "グロース"];
const RANKINGS: RankingType[] = ["値上がり率", "値下がり率", "売買高"];

function fmtRate(n: number) {
  return `${signPrefix(n)}${n.toFixed(2)}%`;
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
                  {signPrefix(r.change)}{fmtPrice(r.change)}
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

export default function ToolClient({
  manifest,
  initialDayData,
}: {
  manifest: RankingManifest;
  initialDayData: RankingDayData | null;
}) {
  const [selectedDate, setSelectedDate] = useState<string>(manifest.latest);
  const [selectedMarket, setSelectedMarket] = useState<RankingMarket>("プライム");
  const [selectedRanking, setSelectedRanking] = useState<RankingType>("値上がり率");
  const { loadedDays, isLoading, loadError } = useDailyMarketData<RankingDayData>({
    activeDate: selectedDate,
    initialDayData,
    routePrefix: "/tools/stock-ranking/data",
  });

  const filtered = useMemo<RankingRecord[]>(() => {
    const day = loadedDays[selectedDate];
    if (!day) return [];
    return day.records.filter(
      (r) => r.market === selectedMarket && r.ranking === selectedRanking,
    );
  }, [loadedDays, selectedDate, selectedMarket, selectedRanking]);
  const currentDateIndex = manifest.dates.indexOf(selectedDate);
  const prevDate =
    currentDateIndex >= 0 && currentDateIndex < manifest.dates.length - 1
      ? manifest.dates[currentDateIndex + 1]
      : null;
  const nextDate = currentDateIndex > 0 ? manifest.dates[currentDateIndex - 1] : null;

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
        background: "#fff",
        borderRadius: 22,
        border: "1px solid rgba(15, 23, 42, 0.04)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        padding: 16,
        marginBottom: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        {/* 日付 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => prevDate && setSelectedDate(prevDate)}
            disabled={!prevDate}
            aria-label="前日へ移動"
            style={{
              width: 34,
              height: 34,
              padding: 0,
              borderRadius: 999,
              border: "1px solid rgba(37, 84, 255, 0.12)",
              background: "#f5f8ff",
              color: prevDate ? "#2554ff" : "#b9c2d0",
              display: "grid",
              placeItems: "center",
              cursor: prevDate ? "pointer" : "default",
              opacity: prevDate ? 1 : 0.45,
            }}
          >
            ‹
          </button>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              minHeight: 38,
              minWidth: 210,
              padding: "8px 12px",
              borderRadius: 10,
              border: "1.5px solid rgba(148, 163, 184, 0.35)",
              background: "#fff",
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
              textAlignLast: "center",
              cursor: "pointer",
            }}
          >
            {manifest.dates.map((d) => (
              <option key={d} value={d}>
                {formatToolDate(d)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => nextDate && setSelectedDate(nextDate)}
            disabled={!nextDate}
            aria-label="翌日へ移動"
            style={{
              width: 34,
              height: 34,
              padding: 0,
              borderRadius: 999,
              border: "1px solid rgba(37, 84, 255, 0.12)",
              background: "#f5f8ff",
              color: nextDate ? "#2554ff" : "#b9c2d0",
              display: "grid",
              placeItems: "center",
              cursor: nextDate ? "pointer" : "default",
              opacity: nextDate ? 1 : 0.45,
            }}
          >
            ›
          </button>
        </div>

        {/* 市場 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", minWidth: 40 }}>
            市場
          </span>
          <TabBar<RankingMarket>
            options={MARKETS}
            value={selectedMarket}
            onChange={setSelectedMarket}
          />
        </div>

        {/* ランキング種別 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", minWidth: 40 }}>
            種別
          </span>
          <TabBar<RankingType>
            options={RANKINGS}
            value={selectedRanking}
            onChange={setSelectedRanking}
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
          <LoadingSpinner />
        ) : (
        <RankingTable records={filtered} rankingType={selectedRanking} />
        )}
      </div>

      {/* データ注記 */}
      <p style={{ marginTop: 16, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
        ※ 投資判断の参考情報としてご利用ください。
      </p>
    </main>
  );
}
