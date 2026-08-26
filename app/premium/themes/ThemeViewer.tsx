import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type {
  ThemeConfidence,
  ThemeDataState,
  ThemeDetailLoadResult,
  ThemeListLoadResult,
  ThemeMetricDefinition,
  ThemeProvenance,
  ThemeSectionAvailability,
  ThemeStatus,
} from "./types";

const STATUS_LABELS: Record<ThemeStatus, string> = {
  draft: "下書き",
  active: "active",
  archived: "アーカイブ",
};

const CONFIDENCE_LABELS: Record<ThemeConfidence, string> = {
  high: "確度 高",
  medium: "確度 中",
  low: "確度 低",
};

const DATA_STATE_LABELS: Record<ThemeDataState, string> = {
  present: "登録あり",
  empty: "登録なし",
  missing: "未提供",
};

const DATA_STATE_COLORS: Record<ThemeDataState, { bg: string; fg: string; border: string }> = {
  present: { bg: "#f0fdf4", fg: "#166534", border: "#bbf7d0" },
  empty: { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" },
  missing: { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" },
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
  fontSize: 13,
  lineHeight: 1.75,
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 6 }).format(value);
}

function StatusBadge({ status }: { status: ThemeStatus }) {
  const color = status === "active"
    ? { bg: "#dcfce7", fg: "#166534", border: "#bbf7d0" }
    : status === "draft"
      ? { bg: "#dbeafe", fg: "#1d4ed8", border: "#bfdbfe" }
      : { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" };
  return (
    <span style={{ ...styles.badge, background: color.bg, color: color.fg, borderColor: color.border }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: ThemeConfidence | null | undefined }) {
  if (!confidence) return <span style={styles.mutedBadge}>確度未登録</span>;
  return <span style={styles.mutedBadge}>{CONFIDENCE_LABELS[confidence]}</span>;
}

function AvailabilityBadge({ availability }: { availability: ThemeSectionAvailability }) {
  const color = DATA_STATE_COLORS[availability.state];
  return (
    <span
      style={{
        ...styles.badge,
        background: color.bg,
        color: color.fg,
        borderColor: color.border,
      }}
    >
      {DATA_STATE_LABELS[availability.state]}
      {availability.state === "present" ? ` ${availability.count}` : ""}
    </span>
  );
}

function Provenance({ provenance }: { provenance: ThemeProvenance }) {
  return (
    <div style={styles.provenance}>
      <span>source: {provenance.source ?? "未登録"}</span>
      <span>as-of: {formatDateTime(provenance.asOf)}</span>
      <ConfidenceBadge confidence={provenance.confidence} />
    </div>
  );
}

function Section({
  title,
  availability,
  children,
  description,
}: {
  title: string;
  availability: ThemeSectionAvailability;
  children: ReactNode;
  description?: string;
}) {
  return (
    <section style={cardStyle}>
      <div style={styles.sectionHeading}>
        <div>
          <h2 style={styles.sectionTitle}>{title}</h2>
          {description ? <p style={{ ...mutedStyle, marginTop: 5 }}>{description}</p> : null}
        </div>
        <AvailabilityBadge availability={availability} />
      </div>
      {children}
    </section>
  );
}

function AvailabilityMessage({
  availability,
  presentMessage,
  emptyMessage,
  missingMessage,
}: {
  availability: ThemeSectionAvailability;
  presentMessage?: string;
  emptyMessage: string;
  missingMessage: string;
}) {
  if (availability.state === "present") return presentMessage ? <p style={mutedStyle}>{presentMessage}</p> : null;
  return (
    <p style={{ ...mutedStyle, marginTop: 14 }}>
      {availability.state === "empty" ? emptyMessage : missingMessage}
    </p>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={styles.externalLink}>
      {children} ↗
    </a>
  );
}

function ViewerState({
  result,
  emptyMessage,
}: {
  result: ThemeListLoadResult | ThemeDetailLoadResult;
  emptyMessage: string;
}) {
  if (result.status === "ok") return null;
  if (result.status === "empty") {
    return (
      <div style={{ ...cardStyle, background: "#fffbeb", borderColor: "#fde68a" }}>
        <h2 style={styles.stateTitle}>データはまだありません</h2>
        <p style={mutedStyle}>{emptyMessage}</p>
      </div>
    );
  }

  const title = result.status === "not_configured"
    ? "サーバー設定が未完了です"
    : result.status === "unauthorized"
      ? "stock-notes APIの認証に失敗しました"
      : result.status === "not_found"
        ? "テーマが見つかりません"
        : result.status === "invalid_response"
          ? "APIレスポンスを表示できません"
          : "stock-notes APIから取得できません";
  const background = result.status === "not_configured" ? "#fffbeb" : "#fef2f2";
  const border = result.status === "not_configured" ? "#fde68a" : "#fecaca";
  const foreground = result.status === "not_configured" ? "#92400e" : "#991b1b";

  return (
    <div style={{ ...cardStyle, background, borderColor: border, color: foreground }}>
      <h2 style={{ ...styles.stateTitle, color: foreground }}>{title}</h2>
      <p style={{ ...mutedStyle, color: foreground }}>{result.message}</p>
      {result.status === "not_configured" ? (
        <p style={{ ...mutedStyle, color: foreground, marginTop: 10 }}>
          `STOCK_NOTES_API_BASE_URL` と `STOCK_NOTES_API_TOKEN` はServer側だけに設定してください。
        </p>
      ) : null}
    </div>
  );
}

function ViewerHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section style={styles.hero}>
      <div style={styles.eyebrow}>{eyebrow}</div>
      <h1 style={styles.title}>{title}</h1>
      <p style={styles.heroDescription}>{description}</p>
      {children}
    </section>
  );
}

export function ThemeListView({ result }: { result: ThemeListLoadResult }) {
  const meta = result.status === "ok" || result.status === "empty" ? result.data : null;
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <nav style={styles.topNav}>
          <Link href="/premium" style={styles.backLink}>← Premium ホーム</Link>
          <span style={styles.readOnlyChip}>読み取り専用</span>
        </nav>

        <ViewerHero
          eyebrow="theme viewer / v1"
          title="テーマViewer"
          description="ChatGPT + Supabaseで整備したテーマの概要と履歴を、stock-notesの専用read modelから確認します。ここではテーマから売買判断を確定しません。"
        >
          {meta ? <Provenance provenance={{ source: meta.source, asOf: meta.asOf, confidence: null }} /> : null}
        </ViewerHero>

        <ViewerState
          result={result}
          emptyMessage="表示できるテーマがありません。ChatGPT + Supabaseの編集チャネルでテーマを登録すると、ここへ反映されます。"
        />

        {result.status === "ok" ? (
          <section style={styles.listGrid}>
            {result.data.themes.map((theme) => (
              <Link key={theme.id} href={`/premium/themes/${encodeURIComponent(theme.id)}`} style={styles.themeCard}>
                <div style={styles.themeCardTop}>
                  <StatusBadge status={theme.status} />
                  <span style={styles.themeSlug}>{theme.slug}</span>
                </div>
                <h2 style={styles.themeTitle}>{theme.displayName}</h2>
                <p style={{ ...mutedStyle, minHeight: 44 }}>
                  {theme.summary ?? "概要未登録"}
                </p>
                <div style={styles.themeCardMeta}>
                  <span>as-of {formatDateTime(theme.asOf)}</span>
                  <ConfidenceBadge confidence={theme.confidence} />
                </div>
                <div style={styles.themeCardMeta}>
                  <span>{theme.analysisCount === null ? "分析履歴数未提供" : `分析 ${theme.analysisCount}件`}</span>
                  <span>{theme.openActionCount === null ? "Action数未提供" : `open action ${theme.openActionCount}件`}</span>
                </div>
                <span style={styles.openLabel}>詳細を見る →</span>
              </Link>
            ))}
          </section>
        ) : null}

        <p style={styles.footnote}>
          テーマの根拠・関連・指標は保存済み情報の表示です。データが空または未提供の場合は、未判明や0件と混同しないよう状態を分けて表示します。
        </p>
      </div>
    </main>
  );
}

function OverviewSection({ data }: { data: NonNullable<Extract<ThemeDetailLoadResult, { status: "ok" }>["data"]> }) {
  const { theme } = data;
  return (
    <Section
      title="概要"
      availability={data.availability.overview}
      description="テーマの登録内容。テーマの存在だけで投資推奨や業績寄与を意味しません。"
    >
      <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
        <div>
          <div style={styles.fieldLabel}>要約</div>
          <div style={styles.longText}>{theme.summary ?? "概要未登録"}</div>
        </div>
        <div>
          <div style={styles.fieldLabel}>テーマ定義</div>
          <div style={styles.longText}>{theme.definition ?? "テーマ定義未登録"}</div>
        </div>
        <Provenance provenance={theme.provenance} />
      </div>
    </Section>
  );
}

function ThesisSection({ data }: { data: NonNullable<Extract<ThemeDetailLoadResult, { status: "ok" }>["data"]> }) {
  const thesis = data.currentThesis;
  const availability = data.availability.thesis;
  if (!thesis) {
    return (
      <Section title="現在の見立て" availability={availability} description="activeだけでなく、下書き状態も明示して表示します。">
        <AvailabilityMessage
          availability={availability}
          emptyMessage="現在の見立ては登録されていません。"
          missingMessage="見立て情報はこのViewer契約から提供されていません。"
        />
      </Section>
    );
  }
  return (
    <Section title="現在の見立て" availability={availability} description="見立てのas-ofと確度を、概要とは分けて確認します。">
      <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
        <div style={styles.inlineMeta}>
          <span style={styles.mutedBadge}>{thesis.status}</span>
          <span style={styles.mutedBadge}>v{thesis.versionNumber ?? "—"}</span>
          <span>as-of {formatDateTime(thesis.asOf)}</span>
          <ConfidenceBadge confidence={thesis.confidence} />
        </div>
        <TextField label="定義" value={thesis.definition} emptyLabel="定義未登録" />
        <TextField label="構造仮説" value={thesis.structuralHypothesis} emptyLabel="構造仮説未登録" />
        <StringListField label="比較・確認レンズ" values={thesis.lenses} emptyLabel="レンズ未登録" />
        <StringListField label="リスク" values={thesis.risks} emptyLabel="リスク未登録" />
        <StringListField label="反証条件" values={thesis.falsificationConditions} emptyLabel="反証条件未登録" />
        <StringListField label="次回確認事項" values={thesis.nextChecks} emptyLabel="次回確認事項未登録" />
      </div>
    </Section>
  );
}

function TextField({ label, value, emptyLabel }: { label: string; value: string | null; emptyLabel: string }) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.longText}>{value ?? emptyLabel}</div>
    </div>
  );
}

function StringListField({ label, values, emptyLabel }: { label: string; values: string[]; emptyLabel: string }) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      {values.length > 0 ? (
        <ul style={styles.compactList}>
          {values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}
        </ul>
      ) : <div style={styles.longText}>{emptyLabel}</div>}
    </div>
  );
}

function AnalysisHistorySection({ data }: { data: NonNullable<Extract<ThemeDetailLoadResult, { status: "ok" }>["data"]> }) {
  const availability = data.availability.analysisHistory;
  return (
    <Section title="分析履歴" availability={availability} description="議論・調査の履歴。sourceと分析時点を併記します。">
      <AvailabilityMessage
        availability={availability}
        emptyMessage="分析履歴はまだありません。"
        missingMessage="分析履歴はこのViewer契約から提供されていません。"
      />
      {data.analysisHistory.length > 0 ? (
        <div style={styles.stack}>
          {data.analysisHistory.map((analysis) => (
            <article key={analysis.id} style={styles.subCard}>
              <div style={styles.itemHeader}>
                <div>
                  <div style={styles.itemEyebrow}>{analysis.analysisType}</div>
                  <h3 style={styles.itemTitle}>{analysis.conclusion ?? "結論未登録"}</h3>
                </div>
                <span style={styles.itemDate}>{formatDateTime(analysis.asOf ?? analysis.createdAt)}</span>
              </div>
              <Provenance provenance={{ source: analysis.source, asOf: analysis.asOf, confidence: analysis.confidence }} />
              <TextField label="根拠メモ" value={analysis.evidence} emptyLabel="根拠メモ未登録" />
              <TextField label="懸念" value={analysis.concerns} emptyLabel="懸念未登録" />
              {analysis.body ? <TextField label="記録本文" value={analysis.body} emptyLabel="本文未登録" /> : null}
              {analysis.sourceUrl ? <ExternalLink href={analysis.sourceUrl}>分析の出典</ExternalLink> : null}
            </article>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function EvidenceSection({ data }: { data: NonNullable<Extract<ThemeDetailLoadResult, { status: "ok" }>["data"]> }) {
  const availability = data.availability.evidence;
  return (
    <Section title="根拠" availability={availability} description="外部事実・解釈・仮説・判断を、verification statusと確度付きで表示します。">
      <AvailabilityMessage
        availability={availability}
        emptyMessage="根拠レコードはまだありません。"
        missingMessage="根拠情報はこのViewer契約から提供されていません。"
      />
      {data.evidence.length > 0 ? (
        <div style={styles.stack}>
          {data.evidence.map((item) => (
            <article key={item.id} style={styles.subCard}>
              <div style={styles.itemHeader}>
                <div style={styles.tagRow}>
                  <span style={styles.mutedBadge}>{item.stance}</span>
                  <span style={styles.mutedBadge}>{item.claimKind}</span>
                  <span style={styles.mutedBadge}>{item.verificationStatus ?? "状態未登録"}</span>
                </div>
                <ConfidenceBadge confidence={item.confidence} />
              </div>
              <div style={styles.longText}>{item.claim ?? "主張未登録"}</div>
              <div style={styles.metaGrid}>
                <span>種別: {item.evidenceType}</span>
                <span>source: {item.sourceType ?? "未登録"}</span>
                <span>source as-of: {formatDate(item.sourceAsOf)}</span>
                <span>確認: {formatDateTime(item.checkedAt)}</span>
              </div>
              <div style={styles.sourceRow}>
                <span>{item.sourceTitle ?? "出典タイトル未登録"}</span>
                {item.sourceUrl ? <ExternalLink href={item.sourceUrl}>出典を開く</ExternalLink> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function DirectLinksSection({ data }: { data: NonNullable<Extract<ThemeDetailLoadResult, { status: "ok" }>["data"]> }) {
  const availability = data.availability.directLinks;
  return (
    <Section title="直接リンク" availability={availability} description="関連対象へのリンクです。テーマとの接点を投資判断と混同しません。">
      <AvailabilityMessage
        availability={availability}
        emptyMessage="直接リンクはまだありません。"
        missingMessage="直接リンク情報はこのViewer契約から提供されていません。"
      />
      {data.directLinks.length > 0 ? (
        <div style={styles.stack}>
          {data.directLinks.map((item) => (
            <article key={item.id} style={styles.subCard}>
              <div style={styles.itemHeader}>
                <div>
                  <div style={styles.itemEyebrow}>{item.targetType} / {item.relationType}</div>
                  <h3 style={styles.itemTitle}>{item.displayName}</h3>
                </div>
                <span style={styles.mutedBadge}>{item.status}</span>
              </div>
              <div style={styles.longText}>{item.relationNote ?? "関連メモ未登録"}</div>
              <div style={styles.metaGrid}>
                <span>対象ID: {item.targetId ?? "未登録"}</span>
                <span>寄与段階: {item.contributionStage ?? "未登録"}</span>
                <span>source: {item.sourceTitle ?? "未登録"}</span>
                <span>source as-of: {formatDate(item.sourceAsOf)}</span>
                <ConfidenceBadge confidence={item.confidence} />
              </div>
              <div style={styles.sourceRow}>
                {item.url ? <ExternalLink href={item.url}>対象リンクを開く</ExternalLink> : <span>対象URL未提供</span>}
                {item.sourceUrl ? <ExternalLink href={item.sourceUrl}>確認元を開く</ExternalLink> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function TaxonomySection({ data }: { data: NonNullable<Extract<ThemeDetailLoadResult, { status: "ok" }>["data"]> }) {
  const availability = data.availability.taxonomyMap;
  const nodesById = new Map(data.taxonomyMap.nodes.map((node) => [node.id, node]));
  return (
    <Section title="Taxonomy map" availability={availability} description="テーマ・企業/銘柄・製品/技術などの分類関係を表示します。未分類は未分類のまま扱います。">
      <AvailabilityMessage
        availability={availability}
        emptyMessage="taxonomy mapはまだありません。"
        missingMessage="taxonomy mapはこのViewer契約から提供されていません。"
      />
      {availability.state === "present" ? (
        <div style={styles.taxonomyGrid}>
          <div>
            <h3 style={styles.subheading}>ノード</h3>
            {data.taxonomyMap.nodes.length > 0 ? (
              <div style={styles.stack}>
                {data.taxonomyMap.nodes.map((node) => (
                  <div key={node.id} style={styles.subCard}>
                    <div style={styles.itemEyebrow}>{node.domain} / {node.kind}</div>
                    <strong>{node.displayName}</strong>
                    <div style={mutedStyle}>{node.description ?? "説明未登録"}</div>
                    <span style={styles.mutedBadge}>{node.status ?? "状態未登録"}</span>
                  </div>
                ))}
              </div>
            ) : <p style={mutedStyle}>ノードはありません。</p>}
          </div>
          <div>
            <h3 style={styles.subheading}>テーマとの接点</h3>
            {data.taxonomyMap.themeLinks.length > 0 ? (
              <ul style={styles.relationList}>
                {data.taxonomyMap.themeLinks.map((link) => (
                  <li key={link.id}>
                    <strong>{nodesById.get(link.nodeId)?.displayName ?? link.nodeId}</strong>
                    <span>{link.relationType}</span>
                    <span>{link.relationNote ?? "メモ未登録"}</span>
                  </li>
                ))}
              </ul>
            ) : <p style={mutedStyle}>テーマとの接点はありません。</p>}
            <h3 style={{ ...styles.subheading, marginTop: 18 }}>ノード間の関係</h3>
            {data.taxonomyMap.edges.length > 0 ? (
              <ul style={styles.relationList}>
                {data.taxonomyMap.edges.map((edge) => (
                  <li key={edge.id}>
                    <strong>{nodesById.get(edge.sourceNodeId)?.displayName ?? edge.sourceNodeId}</strong>
                    <span>{edge.relationType}</span>
                    <strong>{nodesById.get(edge.targetNodeId)?.displayName ?? edge.targetNodeId}</strong>
                    <span>{edge.relationNote ?? "メモ未登録"}</span>
                  </li>
                ))}
              </ul>
            ) : <p style={mutedStyle}>ノード間の関係はありません。</p>}
            {data.taxonomyMap.stockLinks.length > 0 ? (
              <>
                <h3 style={{ ...styles.subheading, marginTop: 18 }}>銘柄との分類リンク</h3>
                <ul style={styles.relationList}>
                  {data.taxonomyMap.stockLinks.map((link) => (
                    <li key={link.id}>
                      <strong>{link.stockId}</strong>
                      <span>{nodesById.get(link.nodeId)?.displayName ?? link.nodeId}</span>
                      <span>{link.strategicRole ?? "役割未登録"}</span>
                      <ConfidenceBadge confidence={link.confidence} />
                      <span>as-of {formatDate(link.asOf)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function MetricDefinitionCard({ definition }: { definition: ThemeMetricDefinition }) {
  return (
    <div style={styles.subCard}>
      <div style={styles.itemHeader}>
        <div>
          <div style={styles.itemEyebrow}>{definition.metricKey}</div>
          <h3 style={styles.itemTitle}>{definition.displayName}</h3>
        </div>
        <span style={styles.mutedBadge}>{definition.scope}</span>
      </div>
      <div style={styles.longText}>{definition.definition ?? "定義未登録"}</div>
      <div style={styles.metaGrid}>
        <span>単位: {definition.unit ?? "未登録"}</span>
        <span>版: {definition.versionNumber ?? "—"}</span>
        <span>{definition.isActive === null ? "有効状態未提供" : definition.isActive ? "active" : "inactive"}</span>
        {definition.appliesToStockId ? <span>対象銘柄: {definition.appliesToStockId}</span> : null}
      </div>
    </div>
  );
}

function MetricsSection({ data }: { data: NonNullable<Extract<ThemeDetailLoadResult, { status: "ok" }>["data"]> }) {
  const availability = data.availability.metrics;
  const definitions = new Map(data.metrics.definitions.map((definition) => [definition.id, definition]));
  const snapshots = new Map(data.metrics.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return (
    <Section title="Metrics" availability={availability} description="指標の定義と値を分け、単位・対象・基準日を確認します。">
      <AvailabilityMessage
        availability={availability}
        emptyMessage="指標定義・値はまだありません。"
        missingMessage="metrics情報はこのViewer契約から提供されていません。"
      />
      {data.metrics.definitions.length > 0 ? (
        <div style={{ ...styles.stack, marginTop: 16 }}>
          <h3 style={styles.subheading}>指標定義</h3>
          {data.metrics.definitions.map((definition) => <MetricDefinitionCard key={definition.id} definition={definition} />)}
        </div>
      ) : null}
      {data.metrics.values.length > 0 ? (
        <div style={{ ...styles.stack, marginTop: 18 }}>
          <h3 style={styles.subheading}>指標値</h3>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>指標</th>
                  <th style={styles.th}>対象</th>
                  <th style={styles.th}>値</th>
                  <th style={styles.th}>基準日 / 期間</th>
                  <th style={styles.th}>根拠</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.values.map((value) => {
                  const definition = definitions.get(value.metricId);
                  const snapshot = snapshots.get(value.snapshotId);
                  return (
                    <tr key={value.id}>
                      <td style={styles.td}>{definition?.displayName ?? value.metricId}<br /><span style={styles.tableMuted}>{definition?.unit ?? "単位未提供"}</span></td>
                      <td style={styles.td}>{value.stockId}</td>
                      <td style={{ ...styles.td, fontWeight: 900 }}>{value.value === null ? "値未取得" : formatNumber(value.value)}</td>
                      <td style={styles.td}>{formatDate(snapshot?.asOf)}<br /><span style={styles.tableMuted}>{snapshot?.periodLabel ?? "期間未提供"}</span></td>
                      <td style={styles.td}>{value.evidenceId ?? "根拠ID未提供"}<br /><span style={styles.tableMuted}>{value.calculationNote ?? "計算メモ未登録"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : data.metrics.definitions.length > 0 ? (
        <p style={{ ...mutedStyle, marginTop: 14 }}>指標定義はありますが、値はまだありません。</p>
      ) : null}
    </Section>
  );
}

function OpenActionsSection({ data }: { data: NonNullable<Extract<ThemeDetailLoadResult, { status: "ok" }>["data"]> }) {
  const availability = data.availability.openActions;
  return (
    <Section title="Open actions" availability={availability} description="テーマの追加調査・確認・再評価の作業キューです。売買注文や数量指定ではありません。">
      <AvailabilityMessage
        availability={availability}
        emptyMessage="open actionはありません。"
        missingMessage="action情報はこのViewer契約から提供されていません。"
      />
      {data.openActions.length > 0 ? (
        <div style={styles.stack}>
          {data.openActions.map((action) => (
            <article key={action.id} style={styles.subCard}>
              <div style={styles.itemHeader}>
                <div>
                  <div style={styles.itemEyebrow}>{action.actionType}</div>
                  <h3 style={styles.itemTitle}>{action.title}</h3>
                </div>
                <span style={styles.mutedBadge}>{action.status}</span>
              </div>
              <TextField label="詳細" value={action.detail} emptyLabel="詳細未登録" />
              <TextField label="実行条件" value={action.triggerCondition} emptyLabel="実行条件未登録" />
              <div style={styles.metaGrid}>
                <span>期限: {formatDate(action.dueDate)}</span>
                <span>登録: {formatDateTime(action.createdAt)}</span>
                <span>更新: {formatDateTime(action.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

export function ThemeDetailView({ result }: { result: ThemeDetailLoadResult }) {
  return (
    <main style={styles.page}>
      <div style={styles.shellWide}>
        <nav style={styles.topNav}>
          <div style={styles.navGroup}>
            <Link href="/premium/themes" style={styles.backLink}>← テーマ一覧</Link>
            <Link href="/premium" style={styles.backLink}>Premium ホーム</Link>
          </div>
          <span style={styles.readOnlyChip}>読み取り専用</span>
        </nav>

        <ViewerState result={result} emptyMessage="指定されたテーマには表示対象のデータがありません。" />

        {result.status === "ok" ? (
          <>
            <ViewerHero
              eyebrow="theme detail / theme-viewer.v1"
              title={result.data.theme.displayName}
              description={`slug: ${result.data.theme.slug}`}
            >
              <div style={styles.heroMetaRow}>
                <StatusBadge status={result.data.theme.status} />
                <span style={styles.mutedBadge}>ID: {result.data.theme.id}</span>
              </div>
              <Provenance provenance={{
                source: result.data.source ?? result.data.theme.provenance.source,
                asOf: result.data.asOf ?? result.data.theme.provenance.asOf,
                confidence: result.data.theme.provenance.confidence,
              }} />
            </ViewerHero>

            <div style={styles.detailGrid}>
              <OverviewSection data={result.data} />
              <ThesisSection data={result.data} />
              <AnalysisHistorySection data={result.data} />
              <EvidenceSection data={result.data} />
              <DirectLinksSection data={result.data} />
              <TaxonomySection data={result.data} />
              <MetricsSection data={result.data} />
              <OpenActionsSection data={result.data} />
            </div>

            <section style={styles.guardrail}>
              <strong>表示上の境界</strong>
              <p style={{ ...mutedStyle, marginTop: 6 }}>
                この画面は保存済みThemeの確認専用です。Themeとの関連、根拠、指標、open actionは売買判断・資金配分・発注を自動確定しません。編集や確定が必要な場合はChatGPT + Supabaseの編集チャネルを使います。
              </p>
            </section>
          </>
        ) : null}
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
    maxWidth: 1120,
    margin: "0 auto",
  },
  shellWide: {
    maxWidth: 1240,
    margin: "0 auto",
  },
  topNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  navGroup: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
  },
  backLink: {
    color: "#64748b",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 800,
  },
  readOnlyChip: {
    display: "inline-flex",
    padding: "5px 10px",
    borderRadius: 999,
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
  },
  hero: {
    marginBottom: 22,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    color: "#4338ca",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.3,
  },
  title: {
    margin: "12px 0 8px",
    color: "#0f172a",
    fontSize: "clamp(30px, 6vw, 46px)",
    lineHeight: 1.12,
    letterSpacing: -1,
    fontWeight: 900,
  },
  heroDescription: {
    maxWidth: 820,
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.8,
  },
  heroMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  provenance: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginTop: 14,
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.5,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 9px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  mutedBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  listGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
    gap: 14,
  },
  themeCard: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 210,
    padding: 18,
    borderRadius: 18,
    background: "#fff",
    border: "1px solid rgba(15,23,42,0.08)",
    color: "var(--color-text)",
    textDecoration: "none",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  themeCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  themeSlug: {
    overflow: "hidden",
    color: "#94a3b8",
    fontSize: 11,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  themeTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 19,
    lineHeight: 1.35,
    fontWeight: 900,
  },
  themeCardMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    color: "#64748b",
    fontSize: 11,
  },
  openLabel: {
    marginTop: "auto",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 900,
  },
  detailGrid: {
    display: "grid",
    gap: 16,
  },
  sectionHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.3,
    fontWeight: 900,
  },
  fieldLabel: {
    marginBottom: 5,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
  },
  longText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.8,
    whiteSpace: "pre-wrap",
  },
  compactList: {
    margin: 0,
    paddingLeft: 20,
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.75,
  },
  inlineMeta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    color: "#64748b",
    fontSize: 12,
  },
  stack: {
    display: "grid",
    gap: 10,
    marginTop: 14,
  },
  subCard: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },
  itemEyebrow: {
    color: "#6366f1",
    fontSize: 11,
    fontWeight: 900,
  },
  itemTitle: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.45,
    fontWeight: 900,
  },
  itemDate: {
    color: "#64748b",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  metaGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "5px 12px",
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.6,
  },
  sourceRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    color: "#64748b",
    fontSize: 12,
  },
  externalLink: {
    color: "#1d4ed8",
    textDecoration: "none",
    fontWeight: 800,
  },
  taxonomyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
    marginTop: 16,
  },
  subheading: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
  },
  relationList: {
    display: "grid",
    gap: 8,
    margin: "10px 0 0",
    padding: 0,
    listStyle: "none",
    color: "#334155",
    fontSize: 12,
    lineHeight: 1.6,
  },
  tableScroll: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: 720,
    borderCollapse: "collapse",
    color: "#334155",
    fontSize: 12,
  },
  th: {
    padding: "8px 7px",
    borderBottom: "1px solid #cbd5e1",
    color: "#64748b",
    textAlign: "left",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 7px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "top",
    lineHeight: 1.6,
  },
  tableMuted: {
    color: "#94a3b8",
    fontSize: 11,
  },
  guardrail: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 13,
    lineHeight: 1.7,
  },
  stateTitle: {
    margin: "0 0 8px",
    fontSize: 17,
    fontWeight: 900,
  },
  footnote: {
    margin: "18px 0 0",
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 1.7,
  },
};
