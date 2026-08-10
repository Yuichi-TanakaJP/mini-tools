// 静的表示のみなので Server Component のまま描画する。
// 状態も入力も持たないため "use client" は付けない。

import type { CSSProperties } from "react";
import Link from "next/link";
import type { Routine, RoutineMode } from "./types";
import {
  MODE_ICONS,
  MODE_LABELS,
  UNTIMED_SLOT,
  WEEKDAYS,
  WEEKDAY_LABELS,
  buildAdhocRoutines,
  buildMonthlyEntries,
  buildWeeklyTimetable,
  summarize,
} from "./timetable";
import { ROUTINES, ROUTINES_SURVEYED_ON } from "./data/routines";

const MODE_COLORS: Record<RoutineMode, { bg: string; fg: string; border: string }> = {
  auto: { bg: "#eff6ff", fg: "#1d4ed8", border: "rgba(29,78,216,0.18)" },
  semi: { bg: "#fef3c7", fg: "#b45309", border: "rgba(180,83,9,0.20)" },
  manual: { bg: "#dcfce7", fg: "#15803d", border: "rgba(21,128,61,0.20)" },
};

function RoutineChip({ routine }: { routine: Routine }) {
  const color = MODE_COLORS[routine.mode];
  return (
    <span
      style={{
        ...styles.chip,
        background: color.bg,
        color: color.fg,
        borderColor: color.border,
      }}
      title={[MODE_LABELS[routine.mode], routine.repo, routine.source]
        .filter(Boolean)
        .join(" / ")}
    >
      <span aria-hidden="true">{MODE_ICONS[routine.mode]}</span>
      {routine.label}
    </span>
  );
}

function SummaryTiles() {
  const summary = summarize(ROUTINES);
  const tiles = [
    { label: "週あたりの実行", value: `${summary.weeklyRuns} 回`, sub: "毎日・毎週のもの" },
    { label: "月あたりの実行", value: `${summary.monthlyRuns} 回`, sub: "月次のもの" },
    {
      label: "登録ルーティン",
      value: `${ROUTINES.length} 件`,
      sub: `自動 ${summary.byMode.auto} / 半自動 ${summary.byMode.semi} / 手動 ${summary.byMode.manual}`,
    },
    { label: "不定期", value: `${summary.adhocCount} 件`, sub: "決まった周期なし" },
  ];

  return (
    <section style={styles.metricsGrid}>
      {tiles.map((tile) => (
        <article key={tile.label} style={styles.metricCard}>
          <div style={styles.metricLabel}>{tile.label}</div>
          <div style={styles.metricValue}>{tile.value}</div>
          <div style={styles.metricSub}>{tile.sub}</div>
        </article>
      ))}
    </section>
  );
}

function WeeklyTimetable() {
  const rows = buildWeeklyTimetable(ROUTINES);

  return (
    <section style={styles.panel}>
      <div style={styles.sectionLabel}>週間タイムテーブル</div>
      <p style={styles.sectionSub}>
        毎日・毎週まわるルーティンを時刻順に並べています。月次と不定期は下のセクションです。
      </p>
      {/* 8 列あるためスマホでは横スクロールさせる */}
      <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.timeColumn }}>時刻</th>
              {WEEKDAYS.map((day) => (
                <th
                  key={day}
                  style={{
                    ...styles.th,
                    color: day === 0 ? "#dc2626" : day === 6 ? "#2563eb" : "#475569",
                  }}
                >
                  {WEEKDAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.time}>
                <th scope="row" style={{ ...styles.timeCell, ...styles.timeColumn }}>
                  {row.time}
                </th>
                {row.cells.map((cell, index) => (
                  <td key={WEEKDAYS[index]} style={styles.td}>
                    {cell.length > 0 ? (
                      <div style={styles.chipStack}>
                        {cell.map(({ routine }) => (
                          <RoutineChip key={routine.id} routine={routine} />
                        ))}
                      </div>
                    ) : (
                      <span style={styles.emptyCell} aria-hidden="true">
                        ―
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={styles.legend}>
        {(["auto", "semi", "manual"] as RoutineMode[]).map((mode) => (
          <span key={mode} style={styles.legendItem}>
            <span aria-hidden="true">{MODE_ICONS[mode]}</span>
            {MODE_LABELS[mode]}
          </span>
        ))}
        <span style={styles.legendItem}>{UNTIMED_SLOT} = 実行時刻を決めていないもの</span>
      </div>
    </section>
  );
}

function MonthlySection() {
  const entries = buildMonthlyEntries(ROUTINES);

  return (
    <section style={styles.panel}>
      <div style={styles.sectionLabel}>月次</div>
      <p style={styles.sectionSub}>月に1回まわるルーティンです。</p>
      <ul style={styles.list}>
        {entries.map((entry) => (
          <li key={`${entry.routine.id}-${entry.time}`} style={styles.listRow}>
            <span style={styles.whenCell}>
              {entry.daysLabel} {entry.time}
            </span>
            <span style={styles.listBody}>
              <RoutineChip routine={entry.routine} />
              <span style={styles.listDescription}>{entry.routine.description}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AdhocSection() {
  const routines = buildAdhocRoutines(ROUTINES);

  return (
    <section style={styles.panel}>
      <div style={styles.sectionLabel}>不定期</div>
      <p style={styles.sectionSub}>
        決まった周期がなく、必要になったときに自分で起動するものです。
      </p>
      <ul style={styles.list}>
        {routines.map((routine) => (
          <li key={routine.id} style={styles.listRow}>
            <span style={styles.whenCell}>随時</span>
            <span style={styles.listBody}>
              <RoutineChip routine={routine} />
              <span style={styles.listDescription}>{routine.description}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RoutinesView() {
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <Link href="/premium" style={styles.backLink}>
            ← Premium ホーム
          </Link>
          <div style={styles.eyebrow}>routine inventory</div>
          <h1 style={styles.title}>ルーティン一覧</h1>
          <p style={styles.description}>
            いま回している定期作業を、自動 / 半自動 / 手動で分けて一枚にまとめたものです。
            実行実績のログではなく、棚卸しした時点の設定内容を静的に表示します。
          </p>
          <div style={styles.metaRow}>
            <span style={styles.metaChip}>棚卸し {ROUTINES_SURVEYED_ON}</span>
            <span style={styles.metaChip}>{ROUTINES.length} ルーティン</span>
          </div>
        </section>

        <SummaryTiles />
        <WeeklyTimetable />
        <MonthlySection />
        <AdhocSection />

        <p style={styles.footnote}>
          自動・半自動は Windows タスクスケジューラの登録内容、手動は各リポジトリの Claude
          スキル定義が出所です。設定を変えたら定義ファイルも更新してください。
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 72px",
    background: "#f8fafc",
  },
  shell: {
    maxWidth: 1080,
    margin: "0 auto",
  },
  hero: {
    marginBottom: 22,
  },
  backLink: {
    // block にして eyebrow チップと同じ行に並ばないようにする
    display: "block",
    marginBottom: 12,
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textDecoration: "none",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4338ca",
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid rgba(67,56,202,0.12)",
  },
  title: {
    margin: "12px 0 8px",
    fontSize: "clamp(30px, 6vw, 44px)",
    fontWeight: 900,
    color: "#0f172a",
  },
  description: {
    margin: 0,
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#475569",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.08)",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
  },
  metricValue: {
    margin: "6px 0 4px",
    fontSize: 26,
    fontWeight: 900,
    color: "#0f172a",
  },
  metricSub: {
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  panel: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(15,23,42,0.06)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },
  sectionSub: {
    margin: "6px 0 14px",
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.6,
  },
  tableScroll: {
    overflowX: "auto",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    // 曜日 7 列にチップが折り返しすぎない幅。狭い画面では横スクロールになる。
    minWidth: 980,
  },
  th: {
    padding: "8px 6px",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "center",
    borderBottom: "1px solid rgba(15,23,42,0.10)",
  },
  timeColumn: {
    width: 76,
    minWidth: 76,
  },
  timeCell: {
    padding: "8px 6px",
    fontSize: 12,
    fontWeight: 800,
    color: "#0f172a",
    textAlign: "left",
    whiteSpace: "nowrap",
    verticalAlign: "top",
    borderBottom: "1px solid rgba(15,23,42,0.05)",
  },
  td: {
    padding: "6px 4px",
    verticalAlign: "top",
    borderBottom: "1px solid rgba(15,23,42,0.05)",
    textAlign: "center",
  },
  chipStack: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "stretch",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 7px",
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.35,
    textAlign: "left",
  },
  emptyCell: {
    fontSize: 11,
    color: "#cbd5e1",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
    fontSize: 11,
    color: "#64748b",
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontWeight: 700,
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  listRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 10,
  },
  whenCell: {
    minWidth: 96,
    fontSize: 12,
    fontWeight: 800,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  listBody: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 200,
  },
  listDescription: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.6,
  },
  footnote: {
    margin: "4px 0 0",
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 1.7,
  },
};
