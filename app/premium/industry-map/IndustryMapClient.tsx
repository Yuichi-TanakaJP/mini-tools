"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./IndustryMap.module.css";
import { ancestorsOf, buildMapContext, selectActiveIds } from "./context";
import { flattenTree } from "./graph-layout";
import { KIND_COLOR, KIND_LABEL, VIEWS } from "./presentation";
import type {
  IndustryMapLoadResult,
  RelationType,
  TaxonomyKind,
  ViewMode,
} from "./types";
import DetailPanel from "./views/DetailPanel";
import MatrixView from "./views/MatrixView";
import NetworkView from "./views/NetworkView";
import RadialView from "./views/RadialView";
import TableView from "./views/TableView";
import TreeView from "./views/TreeView";

const ALL_KINDS: readonly TaxonomyKind[] = ["classification", "product_segment", "technology"];
const ALL_RELATIONS: readonly RelationType[] = [
  "contains",
  "part_of",
  "depends_on",
  "enables",
  "used_for",
  "related_to",
];

/** 初期表示で開いておく深さ。深い階層は畳んでおき、まず全体像を見せる。 */
const INITIAL_EXPAND_DEPTH = 1;

function TopNav() {
  return (
    <nav className={styles.topNav}>
      <Link href="/premium" className={styles.topNavLink}>
        ← Premium ホーム
      </Link>
      <Link href="/premium/themes" className={styles.topNavLink}>
        テーマViewer →
      </Link>
    </nav>
  );
}

function StateScreen({
  icon,
  title,
  body,
  tone,
}: {
  icon: string;
  title: string;
  body: string;
  tone?: "error";
}) {
  return (
    <main className={styles.page}>
      <TopNav />
      <div className={`${styles.state} ${tone === "error" ? styles.stateError : ""}`}>
        <span className={styles.stateIcon} aria-hidden>
          {icon}
        </span>
        <h1 className={styles.stateTitle}>{title}</h1>
        <p className={styles.stateBody}>{body}</p>
      </div>
    </main>
  );
}

export default function IndustryMapClient({ result }: { result: IndustryMapLoadResult }) {
  const data = result.status === "ok" ? result.data : null;
  const domains = useMemo(() => data?.domains ?? [], [data]);

  const [domainKey, setDomainKey] = useState(() => domains[0]?.domain ?? "");
  const [view, setView] = useState<ViewMode>("tree");
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<Set<TaxonomyKind>>(() => new Set(ALL_KINDS));
  const [relations, setRelations] = useState<Set<RelationType>>(() => new Set(ALL_RELATIONS));
  // 選択と展開は domain（= context）ごとの状態。context が変わったら既定値へ戻す。
  const [selection, setSelection] = useState<{ source: unknown; id: string | null } | null>(null);
  const [expansion, setExpansion] = useState<{ source: unknown; ids: Set<string> } | null>(null);

  const domain = useMemo(
    () => domains.find((item) => item.domain === domainKey) ?? domains[0] ?? null,
    [domains, domainKey],
  );

  const context = useMemo(
    () => (domain && data ? buildMapContext(domain, data.stocks, data.themes) : null),
    [domain, data],
  );

  const activeIds = useMemo(
    () => (context ? selectActiveIds(context, kinds, query) : new Set<string>()),
    [context, kinds, query],
  );

  // domain を切り替えたら、浅い階層だけ開いた初期状態に戻す。
  const defaultExpanded = useMemo(() => {
    if (!context) return new Set<string>();
    return new Set(
      flattenTree(context.roots)
        .filter((item) => item.depth < INITIAL_EXPAND_DEPTH + 1 && item.children.length > 0)
        .map((item) => item.node.id),
    );
  }, [context]);

  const selectedId = selection?.source === context ? selection.id : null;
  const expandedIds = expansion?.source === context ? expansion.ids : defaultExpanded;

  // 検索でヒットした項目は、畳まれていても見えるように祖先を開く。
  // 展開状態そのものは書き換えないので、検索を消せば元の畳み方へ戻る。
  const effectiveExpanded = useMemo(() => {
    if (!context || query.trim().length === 0) return expandedIds;
    const ancestors = ancestorsOf(context, activeIds);
    if (ancestors.size === 0) return expandedIds;
    const merged = new Set(expandedIds);
    for (const id of ancestors) merged.add(id);
    return merged;
  }, [context, query, activeIds, expandedIds]);

  if (result.status === "unconfigured") {
    return (
      <StateScreen
        icon="🔌"
        title="Supabase 連携が未設定です"
        body={result.message ?? "業界マップを表示するには Supabase の設定が必要です。"}
      />
    );
  }

  if (result.status === "unauthenticated") {
    return (
      <StateScreen
        icon="🔑"
        title="Supabase にログインしてください"
        body={
          result.message ??
          "業界マップは本人のデータとして保存されています。ログイン後に表示されます。"
        }
      />
    );
  }

  if (result.status === "error") {
    return (
      <StateScreen
        icon="⚠️"
        title="業界マップを取得できませんでした"
        body={`${result.message ?? "取得に失敗しました。"} 0件ではなく取得失敗です。時間をおいて再読み込みしてください。`}
        tone="error"
      />
    );
  }

  if (!data || !domain || !context || domains.length === 0) {
    return (
      <StateScreen
        icon="🗺"
        title="業界マップがまだありません"
        body={
          result.message ??
          "ChatGPT との対話で Supabase に業界マップを保存すると、ここに表示されます。"
        }
      />
    );
  }

  const viewIndex = VIEWS.findIndex((item) => item.mode === view);
  const currentView = VIEWS[viewIndex] ?? VIEWS[0];
  const crossCount = domain.edges.filter(
    (edge) => edge.relationType !== "contains" && edge.relationType !== "part_of",
  ).length;

  const toggleKind = (kind: TaxonomyKind) => {
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      // すべて外すと何も見えなくなるため、最後の1つは外させない。
      return next.size === 0 ? current : next;
    });
  };

  const toggleRelation = (relation: RelationType) => {
    setRelations((current) => {
      const next = new Set(current);
      if (next.has(relation)) next.delete(relation);
      else next.add(relation);
      return next;
    });
  };

  const selectNode = (nodeId: string | null) => setSelection({ source: context, id: nodeId });

  const toggleExpanded = (nodeId: string) => {
    const next = new Set(expandedIds);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    setExpansion({ source: context, ids: next });
  };

  return (
    <main className={styles.page}>
      <TopNav />

      <header className={styles.hero}>
        <div className={styles.heroHead}>
          <div>
            <h1 className={styles.heroTitle}>業界マップ</h1>
            <p className={styles.heroLead}>
              Supabase に保存した産業構造・企業経済圏を、5つの表現に切り替えて確認します。閲覧専用です。
            </p>
          </div>
          <span className={styles.versionBadge}>{data.modelVersion}</span>
        </div>

        <div className={styles.domainRow} role="tablist" aria-label="業界マップの切り替え">
          {domains.map((item) => (
            <button
              key={item.domain}
              type="button"
              role="tab"
              aria-selected={item.domain === domain.domain}
              className={`${styles.domainChip} ${
                item.domain === domain.domain ? styles.domainChipActive : ""
              }`}
              onClick={() => setDomainKey(item.domain)}
            >
              <span className={styles.domainChipName}>{item.label}</span>
              <span className={styles.domainChipMeta}>
                領域 {item.nodes.length} · 関係 {item.edges.length}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>領域</div>
            <div className={styles.statValue}>
              {domain.nodes.length}
              <span className={styles.statUnit}>件</span>
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>横断する関係</div>
            <div className={styles.statValue}>
              {crossCount}
              <span className={styles.statUnit}>件</span>
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>紐づく銘柄</div>
            <div className={styles.statValue}>
              {new Set(domain.stockLinks.map((link) => link.stockId)).size}
              <span className={styles.statUnit}>銘柄</span>
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>紐づくテーマ</div>
            <div className={styles.statValue}>
              {new Set(domain.themeLinks.map((link) => link.themeId)).size}
              <span className={styles.statUnit}>件</span>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="tablist" aria-label="表現の切り替え">
          <span
            className={styles.segmentedIndicator}
            style={{
              left: `calc(3px + (100% - 6px) * ${Math.max(viewIndex, 0)} / ${VIEWS.length})`,
              width: `calc((100% - 6px) / ${VIEWS.length})`,
            }}
            aria-hidden
          />
          {VIEWS.map((item) => (
            <button
              key={item.mode}
              type="button"
              role="tab"
              aria-selected={item.mode === view}
              className={`${styles.segment} ${item.mode === view ? styles.segmentActive : ""}`}
              onClick={() => setView(item.mode)}
              title={item.question}
            >
              <span className={styles.segmentIcon} aria-hidden>
                {item.icon}
              </span>
              <span className={styles.segmentLabel}>{item.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.filterRow}>
          <input
            className={styles.search}
            type="search"
            value={query}
            placeholder="領域名・説明を検索"
            aria-label="領域を検索"
            onChange={(event) => setQuery(event.target.value)}
          />
          {ALL_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`${styles.toggle} ${kinds.has(kind) ? styles.toggleOn : ""}`}
              style={kinds.has(kind) ? { color: KIND_COLOR[kind] } : undefined}
              aria-pressed={kinds.has(kind)}
              onClick={() => toggleKind(kind)}
            >
              <span className={styles.toggleDot} />
              {KIND_LABEL[kind]} {context.kindCounts[kind]}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.hint}>{currentView.question}</p>

      <div className={styles.workspace}>
        <section className={styles.canvas}>
          {view === "tree" ? (
            <div className={styles.canvasScroll}>
              <TreeView
                context={context}
                activeIds={activeIds}
                expandedIds={effectiveExpanded}
                selectedId={selectedId}
                onToggle={toggleExpanded}
                onSelect={selectNode}
              />
            </div>
          ) : null}
          {view === "radial" ? (
            <RadialView
              context={context}
              activeIds={activeIds}
              selectedId={selectedId}
              onSelect={selectNode}
            />
          ) : null}
          {view === "network" ? (
            <NetworkView
              context={context}
              activeIds={activeIds}
              selectedId={selectedId}
              onSelect={selectNode}
              enabledRelations={relations}
              onToggleRelation={toggleRelation}
            />
          ) : null}
          {view === "matrix" ? (
            <MatrixView
              context={context}
              activeIds={activeIds}
              selectedId={selectedId}
              onSelect={selectNode}
            />
          ) : null}
          {view === "table" ? (
            <TableView
              context={context}
              activeIds={activeIds}
              selectedId={selectedId}
              onSelect={selectNode}
            />
          ) : null}
        </section>

        <DetailPanel context={context} selectedId={selectedId} onSelect={selectNode} />
      </div>

      <p className={styles.note}>
        出典は Supabase に保存した自分用の整理内容です。市場の公式分類ではなく、売買の推奨でもありません。
        内容の追加・修正は ChatGPT との対話から行い、この画面は読み取りだけを行います。
      </p>
    </main>
  );
}
