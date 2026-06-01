"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  InvestorFlowAnalysisPayload,
  InvestorFlowCompositionItem,
  InvestorFlowNetRankingItem,
  InvestorFlowPageData,
  InvestorFlowRecord,
} from "./types";

const CATEGORY_ORDER = [
  "総計",
  "自己計",
  "委託計",
  "海外投資家",
  "個人",
  "個人現金",
  "個人信用",
  "法人計",
  "事業法人",
  "投資信託",
  "金融機関計",
  "信託銀行",
  "生保・損保",
  "都銀・地銀等",
  "その他金融機関",
  "証券会社",
  "その他法人等",
  "自己現金",
  "自己信用",
];

const SEGMENT_COLORS = ["#0f766e", "#2563eb", "#dc2626", "#9333ea", "#f59e0b", "#64748b"];

const CATEGORY_LABELS: Record<string, string> = {
  自己計: "自己計（証券会社の自己売買）",
  委託計: "委託計（顧客注文）",
};

const CATEGORY_NOTES = [
  {
    term: "自己計",
    description: "証券会社が顧客注文ではなく、自社の勘定で売買した分です。",
  },
  {
    term: "委託計",
    description: "海外投資家・個人・法人など、顧客からの注文として扱われる売買です。",
  },
  {
    term: "総計",
    description: "自己計と委託計を合わせた市場全体の売買です。",
  },
];

const COMPOSITION_GROUPS = [
  {
    title: "総計の内訳",
    description: "まず市場全体を、証券会社自身の売買（自己計）と顧客注文（委託計）に分けます。",
    denominator: "総計",
    categories: ["自己計", "委託計"],
  },
  {
    title: "委託売買の内訳",
    description: "次に顧客注文である委託計を、海外投資家・個人・法人などに分けます。",
    denominator: "委託計",
    categories: ["海外投資家", "個人", "法人計", "証券会社"],
  },
];

const DETAIL_GROUPS = [
  {
    title: "個人の内訳",
    denominator: "個人",
    categories: ["個人現金", "個人信用"],
  },
  {
    title: "法人の内訳",
    denominator: "法人計",
    categories: ["事業法人", "投資信託", "金融機関計", "その他法人等"],
  },
  {
    title: "金融機関の内訳",
    denominator: "金融機関計",
    categories: ["信託銀行", "生保・損保", "都銀・地銀等", "その他金融機関"],
  },
  {
    title: "自己売買の内訳",
    denominator: "自己計",
    categories: ["自己現金", "自己信用"],
  },
];

type ViewMode = "summary" | "structure" | "details";

const VIEW_TABS: { mode: ViewMode; label: string; description: string }[] = [
  { mode: "summary", label: "サマリー", description: "今週の主な買い越し・売り越しを見る" },
  { mode: "structure", label: "構造", description: "総計・自己計・委託計の関係を見る" },
  { mode: "details", label: "詳細", description: "内訳表で細かい数字を確認する" },
];

function formatDate(value?: string) {
  if (!value) return "未取得";
  const [year, month, day] = value.split("-");
  return `${year}/${month}/${day}`;
}

function formatWeek(start?: string, end?: string) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatGeneratedAt(value?: string) {
  if (!value) return "更新時刻不明";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(parsed));
}

function formatYen(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const oku = value / 100_000_000;
  return `${oku.toLocaleString("ja-JP", {
    maximumFractionDigits: 0,
  })}億円`;
}

function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDirection(value: string | null | undefined) {
  if (value === "net_buy") return "買い越し";
  if (value === "net_sell") return "売り越し";
  if (value === "flat") return "中立";
  return "不明";
}

function getDiffColor(value: number) {
  if (value > 0) return "#dc2626";
  if (value < 0) return "#2563eb";
  return "#64748b";
}

function sortRecords(records: InvestorFlowRecord[]) {
  const order = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
  return [...records].sort((a, b) => {
    const left = order.get(a.category) ?? 999;
    const right = order.get(b.category) ?? 999;
    if (left !== right) return left - right;
    return a.row_index - b.row_index;
  });
}

function getRecord(records: InvestorFlowRecord[], category: string) {
  return records.find((record) => record.category === category) ?? null;
}

function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

function pickRecords(records: InvestorFlowRecord[], categories: string[]) {
  return categories
    .map((category) => getRecord(records, category))
    .filter((record): record is InvestorFlowRecord => record !== null);
}

function getTopMovers(records: InvestorFlowRecord[]) {
  return records
    .filter((record) => record.category !== "総計")
    .sort((a, b) => Math.abs(b.diff_yen) - Math.abs(a.diff_yen))
    .slice(0, 6);
}

function getTopAnalysisMovers(analysis: InvestorFlowAnalysisPayload) {
  return analysis.net_ranking
    .filter((item) => item.category !== "総計" && item.category !== "委託計")
    .slice(0, 6);
}

function getCompositionShare(
  items: InvestorFlowCompositionItem[],
  group: "total" | "commission",
  category: string,
) {
  return items.find((item) => item.group === group && item.category === category)?.share_pct ?? null;
}

function MetricCard({
  label,
  record,
}: {
  label: string;
  record: InvestorFlowRecord | null;
}) {
  const diff = record?.diff_yen ?? 0;
  return (
    <article style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, color: getDiffColor(diff) }}>
        {record ? formatYen(record.diff_yen) : "—"}
      </div>
      <div style={styles.metricSub}>
        買い {record ? formatYen(record.buy_yen) : "—"} / 売り{" "}
        {record ? formatYen(record.sell_yen) : "—"}
      </div>
    </article>
  );
}

function AnalysisMetricCard({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub: string;
  tone: "buy" | "sell" | "neutral";
}) {
  const color = tone === "buy" ? "#dc2626" : tone === "sell" ? "#2563eb" : "#0f766e";
  return (
    <article style={styles.analysisMetricCard}>
      <div style={styles.metricLabel}>{title}</div>
      <div style={{ ...styles.metricValue, color }}>{value}</div>
      <div style={styles.metricSub}>{sub}</div>
    </article>
  );
}

function WeekSelector({ data }: { data: InvestorFlowPageData }) {
  const weeks = data.manifest?.weeks ?? [];
  if (weeks.length === 0) return null;
  return (
    <div style={styles.weekList}>
      {weeks.slice(0, 12).map((week) => {
        const active =
          data.selectedWeek?.start_date === week.start_date &&
          data.selectedWeek?.end_date === week.end_date;
        const href =
          week.start_date === data.manifest?.latest.start_date &&
          week.end_date === data.manifest.latest.end_date
            ? "/tools/investor-flow"
            : `/tools/investor-flow?start=${week.start_date}&end=${week.end_date}`;
        return (
          <Link
            key={`${week.start_date}-${week.end_date}`}
            href={href}
            style={active ? styles.weekButtonActive : styles.weekButton}
          >
            {formatWeek(week.start_date, week.end_date)}
          </Link>
        );
      })}
    </div>
  );
}

function ShareCell({
  value,
  denominator,
}: {
  value: number;
  denominator: number | null | undefined;
}) {
  const pct = denominator ? (value / denominator) * 100 : null;
  const width = pct == null || Number.isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div style={styles.shareCell}>
      <span style={styles.shareText}>{pct == null ? "—" : formatPct(pct)}</span>
      <span style={styles.shareTrack} aria-hidden="true">
        <span style={{ ...styles.shareBar, width: `${width}%` }} />
      </span>
    </div>
  );
}

function CompositionStack({
  label,
  records,
  denominator,
  valueKey,
}: {
  label: string;
  records: InvestorFlowRecord[];
  denominator: number | null | undefined;
  valueKey: "buy_yen" | "sell_yen";
}) {
  const total = denominator && !Number.isNaN(denominator) ? denominator : 0;
  return (
    <div style={styles.stackRow}>
      <div style={styles.stackLabel}>{label}</div>
      <div style={styles.stackTrack}>
        {records.map((record, index) => {
          const pct = total > 0 ? (record[valueKey] / total) * 100 : 0;
          return (
            <span
              key={`${label}-${record.category}`}
              title={`${record.category}: ${formatPct(pct)}`}
              style={{
                ...styles.stackSegment,
                width: `${Math.max(0, Math.min(100, pct))}%`,
                background: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function CompositionCard({
  title,
  description,
  denominator,
  records,
}: {
  title: string;
  description: string;
  denominator: InvestorFlowRecord | null;
  records: InvestorFlowRecord[];
}) {
  if (!denominator || records.length === 0) return null;

  return (
    <article style={styles.compositionCard}>
      <div style={styles.compositionHeader}>
        <div>
          <div style={styles.compositionTitle}>{title}</div>
          <div style={styles.compositionDescription}>{description}</div>
          <div style={styles.compositionSub}>分母: {denominator.category}</div>
        </div>
        <div style={styles.compositionTotal}>
          買い {formatYen(denominator.buy_yen)} / 売り {formatYen(denominator.sell_yen)}
        </div>
      </div>
      <div style={styles.stackGroup}>
        <CompositionStack
          label="買い"
          records={records}
          denominator={denominator.buy_yen}
          valueKey="buy_yen"
        />
        <CompositionStack
          label="売り"
          records={records}
          denominator={denominator.sell_yen}
          valueKey="sell_yen"
        />
      </div>
      <div style={styles.legend}>
        {records.map((record, index) => (
          <span key={record.category} style={styles.legendItem}>
            <span
              style={{
                ...styles.legendSwatch,
                background: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
              }}
            />
            <span>{getCategoryLabel(record.category)}</span>
          </span>
        ))}
      </div>
    </article>
  );
}

function CompactCompositionCard({
  title,
  denominator,
  records,
}: {
  title: string;
  denominator: InvestorFlowRecord | null;
  records: InvestorFlowRecord[];
}) {
  if (!denominator || records.length === 0) return null;

  return (
    <article style={styles.compactCompositionCard}>
      <div style={styles.compactCardTitle}>{title}</div>
      <CompositionStack
        label="買い"
        records={records}
        denominator={denominator.buy_yen}
        valueKey="buy_yen"
      />
      <CompositionStack
        label="売り"
        records={records}
        denominator={denominator.sell_yen}
        valueKey="sell_yen"
      />
      <div style={styles.compactLegend}>
        {records.map((record, index) => (
          <span key={record.category} style={styles.legendItem}>
            <span
              style={{
                ...styles.legendSwatch,
                background: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
              }}
            />
            <span>{getCategoryLabel(record.category)}</span>
          </span>
        ))}
      </div>
    </article>
  );
}

function MoverList({ records }: { records: InvestorFlowRecord[] }) {
  const movers = getTopMovers(records);
  return (
    <section style={styles.moverPanel}>
      <div style={styles.panelHeader}>
        <div>
          <div style={styles.panelTitle}>差引が大きい主体</div>
          <div style={styles.panelSub}>買い越しは赤、売り越しは青で表示しています。</div>
        </div>
      </div>
      <div style={styles.moverList}>
        {movers.map((record) => {
          const color = getDiffColor(record.diff_yen);
          return (
            <div key={record.category} style={styles.moverRow}>
              <div>
                <div style={styles.moverName}>{getCategoryLabel(record.category)}</div>
                <div style={styles.moverSub}>
                  買い {formatYen(record.buy_yen)} / 売り {formatYen(record.sell_yen)}
                </div>
              </div>
              <div style={{ ...styles.moverValue, color }}>{formatYen(record.diff_yen)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AnalysisMoverList({ items }: { items: InvestorFlowNetRankingItem[] }) {
  return (
    <section style={styles.moverPanel}>
      <div style={styles.panelHeader}>
        <div>
          <div style={styles.panelTitle}>買い越し・売り越しの大きさ</div>
          <div style={styles.panelSub}>差引金額の絶対値が大きい主体を並べています。</div>
        </div>
      </div>
      <div style={styles.moverList}>
        {items.map((item) => {
          const color = getDiffColor(item.diff_yen);
          return (
            <div key={item.category} style={styles.moverRow}>
              <div>
                <div style={styles.moverName}>{getCategoryLabel(item.category)}</div>
                <div style={styles.moverSub}>
                  {formatDirection(item.direction)}
                  {item.diff_change_yen == null ? "" : ` / 前週比 ${formatYen(item.diff_change_yen)}`}
                </div>
              </div>
              <div style={{ ...styles.moverValue, color }}>{formatYen(item.diff_yen)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AnalysisSummaryView({ analysis }: { analysis: InvestorFlowAnalysisPayload }) {
  const topMovers = getTopAnalysisMovers(analysis);
  const latestReversals = analysis.reversals.slice(0, 4);
  const streaks = analysis.streaks.slice(0, 4);
  const overseasBuyShare = getCompositionShare(analysis.buy_composition, "commission", "海外投資家");
  const individualBuyShare = getCompositionShare(analysis.buy_composition, "commission", "個人");
  const proprietaryBuyShare = getCompositionShare(analysis.buy_composition, "total", "自己計");

  return (
    <div style={styles.analysisLayout}>
      <section style={styles.analysisMetricGrid}>
        <AnalysisMetricCard
          title="最大の買い越し"
          value={
            analysis.summary.largest_net_buy
              ? formatYen(analysis.summary.largest_net_buy.diff_yen)
              : "—"
          }
          sub={analysis.summary.largest_net_buy?.category ?? "該当なし"}
          tone="buy"
        />
        <AnalysisMetricCard
          title="最大の売り越し"
          value={
            analysis.summary.largest_net_sell
              ? formatYen(analysis.summary.largest_net_sell.diff_yen)
              : "—"
          }
          sub={analysis.summary.largest_net_sell?.category ?? "該当なし"}
          tone="sell"
        />
        <AnalysisMetricCard
          title="海外投資家の買い構成"
          value={formatPct(overseasBuyShare)}
          sub="委託計の買いに占める割合"
          tone="neutral"
        />
        <AnalysisMetricCard
          title="個人の買い構成"
          value={formatPct(individualBuyShare)}
          sub={`自己計は総計の ${formatPct(proprietaryBuyShare)}`}
          tone="neutral"
        />
      </section>

      <div style={styles.viewGrid}>
        <AnalysisMoverList items={topMovers} />
        <section style={styles.signalPanel}>
          <div style={styles.panelTitle}>反転した主体</div>
          <div style={styles.panelSub}>前週と売買方向が変わった主体です。</div>
          <div style={styles.signalList}>
            {latestReversals.length > 0 ? (
              latestReversals.map((item) => (
                <div key={item.category} style={styles.signalRow}>
                  <div>
                    <div style={styles.moverName}>{getCategoryLabel(item.category)}</div>
                    <div style={styles.moverSub}>
                      {formatDirection(item.from_direction)} → {formatDirection(item.to_direction)}
                    </div>
                  </div>
                  <div style={{ ...styles.moverValue, color: getDiffColor(item.current_diff_yen) }}>
                    {formatYen(item.current_diff_yen)}
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.emptyMini}>反転した主体はありません。</div>
            )}
          </div>
        </section>
      </div>

      <section style={styles.signalPanel}>
        <div style={styles.panelTitle}>継続している流れ</div>
        <div style={styles.panelSub}>同じ方向の買い越し・売り越しが続いている主体です。</div>
        <div style={styles.streakGrid}>
          {streaks.map((item) => (
            <div key={item.category} style={styles.streakItem}>
              <span style={styles.streakName}>{getCategoryLabel(item.category)}</span>
              <span style={{ ...styles.streakValue, color: getDiffColor(item.current_diff_yen ?? 0) }}>
                {formatDirection(item.direction)} {item.weeks}週
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryView({
  records,
  analysis,
}: {
  records: InvestorFlowRecord[];
  analysis: InvestorFlowAnalysisPayload | null;
}) {
  if (analysis) {
    return <AnalysisSummaryView analysis={analysis} />;
  }

  return (
    <div style={styles.viewGrid}>
      <MoverList records={records} />
      <section style={styles.compactCompositionGrid}>
        {COMPOSITION_GROUPS.map((group) => (
          <CompactCompositionCard
            key={group.title}
            title={group.title}
            denominator={getRecord(records, group.denominator)}
            records={pickRecords(records, group.categories)}
          />
        ))}
      </section>
    </div>
  );
}

function StructureNode({
  record,
  note,
  tone = "default",
}: {
  record: InvestorFlowRecord | null;
  note: string;
  tone?: "default" | "primary";
}) {
  if (!record) return null;
  const diffColor = getDiffColor(record.diff_yen);
  return (
    <article style={tone === "primary" ? styles.structureNodePrimary : styles.structureNode}>
      <div style={styles.structureName}>{getCategoryLabel(record.category)}</div>
      <div style={{ ...styles.structureValue, color: diffColor }}>{formatYen(record.diff_yen)}</div>
      <div style={styles.structureNote}>{note}</div>
    </article>
  );
}

function StructureView({ records }: { records: InvestorFlowRecord[] }) {
  const commissionRecords = pickRecords(records, ["海外投資家", "個人", "法人計", "証券会社"]);
  return (
    <div style={styles.structureLayout}>
      <section style={styles.structureBand}>
        <StructureNode
          record={getRecord(records, "総計")}
          note="市場全体。自己計と委託計を合わせた合計です。"
          tone="primary"
        />
        <div style={styles.structureSplit}>
          <StructureNode
            record={getRecord(records, "自己計")}
            note="証券会社が自社の勘定で売買した分です。"
          />
          <StructureNode
            record={getRecord(records, "委託計")}
            note="顧客注文として扱われる売買です。"
          />
        </div>
      </section>
      <section style={styles.structureBand}>
        <div style={styles.panelTitle}>委託計の中身</div>
        <div style={styles.structureChildGrid}>
          {commissionRecords.map((record) => (
            <StructureNode
              key={record.category}
              record={record}
              note={`委託計に含まれる ${record.category} の売買です。`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DetailTable({
  title,
  denominator,
  records,
}: {
  title: string;
  denominator: InvestorFlowRecord | null;
  records: InvestorFlowRecord[];
}) {
  if (!denominator || records.length === 0) return null;

  return (
    <details style={styles.detailPanel}>
      <summary style={styles.detailSummary}>
        <span>{title}</span>
        <span style={styles.detailSummarySub}>分母: {denominator.category}</span>
      </summary>
      <div style={styles.tableWrapCompact}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thLeft}>投資主体</th>
              <th style={styles.thRight}>買い</th>
              <th style={styles.thRight}>売り</th>
              <th style={styles.thRight}>差引</th>
              <th style={styles.thRight}>買い構成比</th>
              <th style={styles.thRight}>売り構成比</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const diffColor = getDiffColor(record.diff_yen);
              return (
                <tr key={`${record.row_index}-${record.category}`} style={styles.row}>
                  <td style={styles.tdLeft}>
                    <span style={styles.categoryName}>{record.category}</span>
                  </td>
                  <td style={styles.tdRight}>{formatYen(record.buy_yen)}</td>
                  <td style={styles.tdRight}>{formatYen(record.sell_yen)}</td>
                  <td style={{ ...styles.tdRightStrong, color: diffColor }}>
                    {formatYen(record.diff_yen)}
                  </td>
                  <td style={styles.tdRightMuted}>
                    <ShareCell value={record.buy_yen} denominator={denominator.buy_yen} />
                  </td>
                  <td style={styles.tdRightMuted}>
                    <ShareCell value={record.sell_yen} denominator={denominator.sell_yen} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function FlowOverview({
  records,
  analysis,
}: {
  records: InvestorFlowRecord[];
  analysis: InvestorFlowAnalysisPayload | null;
}) {
  const [mode, setMode] = useState<ViewMode>("summary");

  if (records.length === 0) {
    return <div style={styles.emptyBlock}>表示できる行がありません。</div>;
  }

  return (
    <div style={styles.flowLayout}>
      <section style={styles.viewTabs} aria-label="表示方法">
        {VIEW_TABS.map((tab) => {
          const active = mode === tab.mode;
          return (
            <button
              key={tab.mode}
              type="button"
              onClick={() => setMode(tab.mode)}
              style={active ? styles.viewTabActive : styles.viewTab}
            >
              <span style={styles.viewTabLabel}>{tab.label}</span>
              <span style={styles.viewTabDescription}>{tab.description}</span>
            </button>
          );
        })}
      </section>
      {mode === "summary" ? <SummaryView records={records} analysis={analysis} /> : null}
      {mode === "structure" ? <StructureView records={records} /> : null}
      {mode === "details" ? (
        <>
          <section style={styles.termNote} aria-label="投資主体区分の説明">
            <div style={styles.termNoteTitle}>区分の見方</div>
            <div style={styles.termGrid}>
              {CATEGORY_NOTES.map((note) => (
                <div key={note.term} style={styles.termItem}>
                  <span style={styles.termName}>{note.term}</span>
                  <span style={styles.termDescription}>{note.description}</span>
                </div>
              ))}
            </div>
          </section>
          <section style={styles.compositionGrid}>
            {COMPOSITION_GROUPS.map((group) => (
              <CompositionCard
                key={group.title}
                title={group.title}
                description={group.description}
                denominator={getRecord(records, group.denominator)}
                records={pickRecords(records, group.categories)}
              />
            ))}
          </section>
          <section style={styles.detailList}>
            <div style={styles.detailListHeader}>詳細内訳</div>
            {DETAIL_GROUPS.map((group) => (
              <DetailTable
                key={group.title}
                title={group.title}
                denominator={getRecord(records, group.denominator)}
                records={pickRecords(records, group.categories)}
              />
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function ToolClient({ data }: { data: InvestorFlowPageData }) {
  const records = useMemo(() => sortRecords(data.payload?.records ?? []), [data.payload]);
  const overseas = getRecord(records, "海外投資家");
  const individual = getRecord(records, "個人");
  const trust = getRecord(records, "信託銀行");
  const total = getRecord(records, "総計");
  const payload = data.payload;
  const analysis = data.analysis;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.eyebrow}>JPX weekly investor flow</div>
          <h1 style={styles.title}>投資主体別売買動向</h1>
          <p style={styles.description}>
            JPX公式の週間売買状況から、海外投資家・個人・法人などの買い越し / 売り越しを確認できます。
          </p>
          {payload ? (
            <div style={styles.metaRow}>
              <span style={styles.metaChip}>
                {formatWeek(payload.start_date, payload.end_date)}
              </span>
              <span style={styles.metaChip}>
                更新 {formatGeneratedAt(payload.generated_at_jst)}
              </span>
              <span style={styles.metaChip}>{payload.market_scope}</span>
            </div>
          ) : null}
        </section>

        {!data.manifest ? (
          <article style={styles.emptyCard}>
            <div style={styles.emptyTitle}>データ取得先が未接続です</div>
            <p style={styles.emptyText}>
              投資主体別売買動向は現在表示できません。
            </p>
          </article>
        ) : (
          <>
            <section style={styles.panel}>
              <div style={styles.sectionLabel}>表示週</div>
              <WeekSelector data={data} />
            </section>

            {data.loadFailed ? (
              <article style={styles.errorCard}>
                <div style={styles.errorTitle}>選択週のデータを取得できませんでした</div>
                <p style={styles.errorText}>
                  {formatWeek(data.selectedWeek?.start_date, data.selectedWeek?.end_date)} のデータを
                  時間を置いて再読み込みしてください。
                </p>
              </article>
            ) : (
              <>
                <section style={styles.metricsGrid}>
                  <MetricCard label="海外投資家" record={overseas} />
                  <MetricCard label="個人" record={individual} />
                  <MetricCard label="信託銀行" record={trust} />
                  <MetricCard label="総計" record={total} />
                </section>

                {data.analysisLoadFailed ? (
                  <article style={styles.noticeCard}>
                    分析サマリーを取得できなかったため、生データから表示しています。
                  </article>
                ) : null}

                <section style={styles.tableSection}>
                  <div style={styles.summaryRow}>
                    <div>
                      <div style={styles.summaryTitle}>
                        {data.payload?.week_label_raw ?? "週次データ"}
                      </div>
                      <div style={styles.summarySub}>
                        単位: {data.payload?.unit === "thousand_yen" ? "千円" : data.payload?.unit ?? "—"}
                      </div>
                    </div>
                    {data.payload?.source_url ? (
                      <a
                        href={data.payload.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.sourceLink}
                      >
                        JPX元データ
                      </a>
                    ) : null}
                  </div>
                  <FlowOverview records={records} analysis={analysis} />
                </section>
              </>
            )}
          </>
        )}
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
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background: "#ecfeff",
    color: "#0f766e",
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid rgba(15,118,110,0.12)",
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
  panel: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(15,23,42,0.06)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
    marginBottom: 16,
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  weekList: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  weekButton: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#f8fafc",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    textDecoration: "none",
  },
  weekButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 12,
    border: "1.5px solid #0f766e",
    background: "#ecfeff",
    color: "#134e4a",
    fontSize: 12,
    fontWeight: 900,
    textDecoration: "none",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },
  analysisMetricCard: {
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 14,
    padding: 14,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
  },
  metricValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 900,
  },
  metricSub: {
    marginTop: 8,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.5,
  },
  tableSection: {
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
  },
  summarySub: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  sourceLink: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 800,
    textDecoration: "none",
  },
  flowLayout: {
    display: "grid",
    gap: 16,
  },
  analysisLayout: {
    display: "grid",
    gap: 14,
  },
  analysisMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  viewTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 8,
    padding: 6,
    borderRadius: 14,
    background: "#f1f5f9",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  viewTab: {
    display: "grid",
    gap: 3,
    minHeight: 58,
    padding: "10px 12px",
    border: "1px solid transparent",
    borderRadius: 10,
    background: "transparent",
    color: "#475569",
    textAlign: "left",
    cursor: "pointer",
  },
  viewTabActive: {
    display: "grid",
    gap: 3,
    minHeight: 58,
    padding: "10px 12px",
    border: "1px solid rgba(15,118,110,0.26)",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(15,23,42,0.08)",
  },
  viewTabLabel: {
    fontSize: 13,
    fontWeight: 900,
  },
  viewTabDescription: {
    fontSize: 11,
    lineHeight: 1.4,
    color: "#64748b",
  },
  viewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 14,
  },
  moverPanel: {
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#ffffff",
  },
  signalPanel: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#ffffff",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  },
  panelSub: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 1.5,
    color: "#64748b",
  },
  moverList: {
    display: "grid",
  },
  moverRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "12px 0",
    borderTop: "1px solid rgba(15,23,42,0.07)",
  },
  moverName: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
  },
  moverSub: {
    marginTop: 4,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },
  moverValue: {
    flex: "0 0 auto",
    fontSize: 18,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  signalList: {
    display: "grid",
  },
  signalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "11px 0",
    borderTop: "1px solid rgba(15,23,42,0.07)",
  },
  streakGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
  },
  streakItem: {
    display: "grid",
    gap: 4,
    padding: 11,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  streakName: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0f172a",
  },
  streakValue: {
    fontSize: 12,
    fontWeight: 900,
  },
  compactCompositionGrid: {
    display: "grid",
    gap: 12,
  },
  compactCompositionCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
  },
  compactCardTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
  },
  compactLegend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 10px",
  },
  compositionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  compositionCard: {
    display: "grid",
    gap: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
  },
  compositionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  compositionTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  },
  compositionDescription: {
    marginTop: 5,
    maxWidth: 520,
    fontSize: 12,
    lineHeight: 1.6,
    color: "#475569",
  },
  compositionSub: {
    marginTop: 3,
    fontSize: 11,
    color: "#64748b",
    fontWeight: 700,
  },
  compositionTotal: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
  },
  stackGroup: {
    display: "grid",
    gap: 10,
  },
  stackRow: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr)",
    alignItems: "center",
    gap: 10,
  },
  stackLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "#475569",
  },
  stackTrack: {
    display: "flex",
    height: 22,
    overflow: "hidden",
    borderRadius: 8,
    background: "#e2e8f0",
  },
  stackSegment: {
    display: "block",
    height: "100%",
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px 10px",
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    color: "#475569",
    fontWeight: 800,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  detailList: {
    display: "grid",
    gap: 10,
  },
  detailListHeader: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
  },
  structureLayout: {
    display: "grid",
    gap: 14,
  },
  structureBand: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#ffffff",
  },
  structureSplit: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  structureChildGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },
  structureNodePrimary: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 12,
    border: "1px solid rgba(15,118,110,0.22)",
    background: "#f0fdfa",
  },
  structureNode: {
    display: "grid",
    gap: 5,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
  },
  structureName: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
  },
  structureValue: {
    fontSize: 20,
    fontWeight: 900,
  },
  structureNote: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "#64748b",
  },
  termNote: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(15,118,110,0.16)",
    background: "#f0fdfa",
  },
  termNoteTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "#134e4a",
  },
  termGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 8,
  },
  termItem: {
    display: "grid",
    gap: 3,
  },
  termName: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0f766e",
  },
  termDescription: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "#334155",
  },
  detailPanel: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    overflow: "hidden",
    background: "#ffffff",
  },
  detailSummary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "11px 13px",
    cursor: "pointer",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
  },
  detailSummarySub: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  tableWrap: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 14,
  },
  tableWrapCompact: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    borderTop: "1px solid rgba(15,23,42,0.08)",
  },
  table: {
    width: "100%",
    minWidth: 760,
    borderCollapse: "collapse",
    fontSize: 13,
  },
  thLeft: {
    padding: "10px 12px",
    textAlign: "left",
    background: "#f8fafc",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  thRight: {
    padding: "10px 12px",
    textAlign: "right",
    background: "#f8fafc",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 800,
  },
  row: {
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  tdLeft: {
    padding: "10px 12px",
    textAlign: "left",
  },
  tdRight: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#0f172a",
  },
  tdRightStrong: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    fontWeight: 900,
  },
  tdRightMuted: {
    padding: "10px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#64748b",
  },
  categoryName: {
    fontWeight: 900,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  shareCell: {
    display: "grid",
    gridTemplateColumns: "48px minmax(54px, 1fr)",
    alignItems: "center",
    gap: 8,
    justifyContent: "end",
  },
  shareText: {
    color: "#475569",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
  },
  shareTrack: {
    display: "block",
    width: "100%",
    height: 7,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },
  shareBar: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    background: "#0f766e",
  },
  emptyCard: {
    padding: "32px 24px",
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.06)",
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  emptyText: {
    margin: "10px auto 0",
    maxWidth: 520,
    fontSize: 13,
    lineHeight: 1.7,
    color: "#64748b",
  },
  emptyBlock: {
    padding: "32px 20px",
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
  },
  emptyMini: {
    padding: "14px 0",
    color: "#64748b",
    fontSize: 12,
  },
  noticeCard: {
    marginBottom: 16,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(245,158,11,0.22)",
    background: "#fffbeb",
    color: "#92400e",
    fontSize: 12,
    fontWeight: 800,
  },
  errorCard: {
    padding: "24px 20px",
    borderRadius: 18,
    border: "1px solid rgba(245,158,11,0.28)",
    background: "#fff7ed",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: "#9a3412",
  },
  errorText: {
    margin: "10px 0 0",
    fontSize: 13,
    color: "#7c2d12",
    lineHeight: 1.7,
  },
};
