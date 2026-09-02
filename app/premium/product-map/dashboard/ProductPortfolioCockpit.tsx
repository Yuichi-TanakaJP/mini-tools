"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { WorkspaceCoreApiResponse, WorkspaceCoreOverview } from "@/lib/workspace-core/types";
import {
  buildProductPortfolio,
  filterWorkspaceOverview,
  focusProducts,
  portfolioStatus,
  productTypeBreakdown,
  providerUsage,
  reviewQueue,
  technologyUsage,
  type ProductPortfolioRow,
  type UsageBreakdown,
} from "../dashboard-model";
import styles from "./ProductPortfolioCockpit.module.css";

type LoadState = "loading" | "ok" | "unconfigured" | "error";

const TYPE: Record<string, string> = {
  application: "Application", service: "Service", automation: "Automation", library: "Library",
  infrastructure: "Infrastructure", knowledge: "Knowledge", experiment: "Experiment", other: "Other",
};
const LIFE: Record<string, string> = {
  planned: "Planned", experimental: "Experimental", active: "Active", paused: "Paused", archived: "Archived", unknown: "Unknown",
};

async function fetchOverview(): Promise<WorkspaceCoreApiResponse<WorkspaceCoreOverview>> {
  const response = await fetch("/api/premium/workspace-core?mode=overview", { credentials: "same-origin", cache: "no-store" });
  return (await response.json()) as WorkspaceCoreApiResponse<WorkspaceCoreOverview>;
}

function lifeClass(status: string) {
  if (status === "active") return styles.active;
  if (status === "experimental") return styles.experimental;
  if (status === "paused") return styles.paused;
  if (status === "archived") return styles.archived;
  return styles.neutral;
}

function priorityLabel(value: number) {
  if (value >= 5) return "Core";
  if (value >= 4) return "High";
  if (value >= 3) return "Medium";
  return "Normal";
}

function runtimeNames(product: ProductPortfolioRow) {
  const names = product.runtimeProviders.map((provider) => provider.providerName);
  return names.length ? names.join(" · ") : "未登録";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function Heading({ step, title, description, action }: { step: string; title: string; description: string; action?: ReactNode }) {
  return <div className={styles.heading}><div><div className={styles.step}>{step}</div><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}

function ProductIdentity({ product }: { product: ProductPortfolioRow }) {
  return <div className={styles.identity}>
    <div className={styles.identityTop}><strong>{product.name}</strong><span className={`${styles.life} ${lifeClass(product.lifecycleStatus)}`}>{LIFE[product.lifecycleStatus] ?? product.lifecycleStatus}</span></div>
    <p>{product.description ?? "説明未登録 — Productの目的をWorkspace Coreへ補完する候補"}</p>
  </div>;
}

function FocusCard({ product }: { product: ProductPortfolioRow }) {
  return <article className={styles.focusCard}>
    <div className={styles.focusTop}><span className={styles.priority}>{priorityLabel(product.importance)} · {product.importance}/5</span><span>{TYPE[product.productType] ?? product.productType}</span></div>
    <ProductIdentity product={product} />
    <div className={styles.focusFacts}><div><span>Runtime</span><strong>{runtimeNames(product)}</strong></div><div><span>Connected</span><strong>{product.relatedProductSlugs.length} Product</strong></div></div>
    <div className={styles.actions}>
      {product.primaryRepository?.htmlUrl ? <a href={product.primaryRepository.htmlUrl} target="_blank" rel="noreferrer">GitHub ↗</a> : <span>GitHub未登録</span>}
      <Link href="/premium/product-map">Product Map →</Link>
    </div>
  </article>;
}

function Breakdown({ items, labels }: { items: UsageBreakdown[]; labels?: Record<string, string> }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <div className={styles.breakdown}>{items.map((item) => <div className={styles.breakRow} key={item.slug} title={item.products.join(", ")}><span>{labels?.[item.slug] ?? item.name}</span><div><i style={{ width: `${Math.max(6, item.count / max * 100)}%` }} /></div><b>{item.count}</b></div>)}</div>;
}

export default function ProductPortfolioCockpit() {
  const [overview, setOverview] = useState<WorkspaceCoreOverview | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [productType, setProductType] = useState("all");
  const [lifecycle, setLifecycle] = useState("all");
  const [providerSlug, setProviderSlug] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetchOverview().then((result) => {
      if (cancelled) return;
      if (result.status === "ok" && result.data) { setOverview(result.data); setState("ok"); return; }
      setMessage(result.message ?? "Workspace Coreを取得できませんでした。");
      setState(result.status === "unconfigured" ? "unconfigured" : "error");
    }).catch(() => { if (!cancelled) { setMessage("Workspace Core APIへの接続に失敗しました。"); setState("error"); } });
    return () => { cancelled = true; };
  }, []);

  const scope = useMemo(() => overview ? filterWorkspaceOverview(overview, { query, productType, lifecycle, providerSlug }) : null, [overview, query, productType, lifecycle, providerSlug]);
  const portfolio = useMemo(() => scope ? buildProductPortfolio(scope) : [], [scope]);
  const status = useMemo(() => overview ? portfolioStatus(overview) : null, [overview]);
  const focus = useMemo(() => overview ? focusProducts(overview) : [], [overview]);
  const reviews = useMemo(() => overview ? reviewQueue(overview) : [], [overview]);
  const types = useMemo(() => scope ? productTypeBreakdown(scope) : [], [scope]);
  const providers = useMemo(() => scope ? providerUsage(scope).slice(0, 8) : [], [scope]);
  const technologies = useMemo(() => scope ? technologyUsage(scope).slice(0, 8) : [], [scope]);
  const providerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const link of overview?.providerLinks ?? []) map.set(link.providerSlug, link.providerName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [overview]);
  const productTypes = useMemo(() => [...new Set((overview?.products ?? []).map((p) => p.productType))].sort(), [overview]);
  const lifecycles = useMemo(() => [...new Set((overview?.products ?? []).map((p) => p.lifecycleStatus))].sort(), [overview]);

  if (state !== "ok" || !overview || !scope || !status) return <main className={styles.page}><div className={styles.shell}><Link className={styles.back} href="/premium">← Premium</Link><div className={state === "loading" ? styles.loading : styles.error}>{state === "loading" ? "Product portfolioを読み込んでいます…" : message}</div></div></main>;

  return <main className={styles.page}><div className={styles.shell}>
    <div className={styles.topbar}><div><Link className={styles.back} href="/premium">Premium</Link><span> / Workspace Dashboard</span></div><Link className={styles.button} href="/premium/product-map">Product Mapを開く</Link></div>

    <header className={styles.hero}><div><div className={styles.heroLabel}>DEVELOPMENT PORTFOLIO</div><h1>プロダクト全体を、判断できる形で見る。</h1><p>何を持っていて、何が中核で、何を見直すべきかを最初に確認する画面です。Repository・Technology・ProviderはProduct判断の根拠として下位に置きます。</p></div><div className={styles.connected}><i /> Workspace Core connected</div></header>

    <section><Heading step="01 / STATUS" title="Portfolio status" description="まず、今のプロダクト群がどんな状態かだけを見る。" /><div className={styles.metrics}>
      <div><span>All products</span><b>{status.products}</b><small>registered</small></div>
      <div className={styles.metricActive}><span>Active</span><b>{status.active}</b><small>現役Product</small></div>
      <div><span>High priority</span><b>{status.highImportance}</b><small>importance 4–5</small></div>
      <div className={styles.metricWarning}><span>Experimental</span><b>{status.experimental}</b><small>継続判断候補</small></div>
      <div className={styles.metricMuted}><span>Inactive</span><b>{status.inactive}</b><small>paused / archived</small></div>
    </div></section>

    <section className={styles.cockpit}>
      <div className={styles.panel}><Heading step="02 / FOCUS" title="Focus products" description="重要度とlifecycleから、先に目に入れる中核Product。" /><div className={styles.focusGrid}>{focus.map((product) => <FocusCard product={product} key={product.slug} />)}</div></div>
      <div className={styles.panel}><Heading step="03 / REVIEW" title="Review queue" description="障害ではなく、整理・判断が必要な候補。" /><div className={styles.reviewList}>{reviews.length ? reviews.slice(0, 6).map((product) => <div className={styles.reviewItem} key={product.slug}><div><strong>{product.name}</strong><div>{product.reviewSignals.map((signal) => <span className={signal.tone === "warning" ? styles.signalWarning : styles.signalMuted} key={`${product.slug}-${signal.code}`} title={signal.detail}>{signal.label}</span>)}</div></div><b>{product.importance}/5</b></div>) : <div className={styles.empty}>レビュー候補はありません。</div>}</div><div className={styles.note}>「運用先未登録」はWorkspace Core上の登録状況であり、サービス停止を意味しません。</div></div>
    </section>

    <section className={styles.portfolio}><Heading step="04 / PORTFOLIO" title="Product portfolio" description="主一覧。目的・状態・重要度・運用先・Repository・接続だけを比較する。" action={<span className={styles.count}>{portfolio.length} / {overview.products.length}</span>} />
      <div className={styles.toolbar}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product / Repo / Technology / Provider を検索" /><select value={productType} onChange={(e) => setProductType(e.target.value)}><option value="all">全Type</option>{productTypes.map((type) => <option value={type} key={type}>{TYPE[type] ?? type}</option>)}</select><select value={lifecycle} onChange={(e) => setLifecycle(e.target.value)}><option value="all">全Lifecycle</option>{lifecycles.map((life) => <option value={life} key={life}>{LIFE[life] ?? life}</option>)}</select><select value={providerSlug} onChange={(e) => setProviderSlug(e.target.value)}><option value="all">全Provider</option>{providerOptions.map(([slug, name]) => <option value={slug} key={slug}>{name}</option>)}</select></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Product / purpose</th><th>Priority</th><th>Type</th><th>Runtime / deploy</th><th>Primary repo</th><th>Connected</th><th>Registry update</th></tr></thead><tbody>{portfolio.map((product) => <tr key={product.slug}><td className={styles.productCell}><ProductIdentity product={product} /></td><td><b>{product.importance}/5</b><small>{priorityLabel(product.importance)}</small></td><td><span className={styles.typePill}>{TYPE[product.productType] ?? product.productType}</span></td><td><b>{runtimeNames(product)}</b>{product.serviceInstances.length ? <small>{product.serviceInstances.length} concrete instance</small> : null}</td><td>{product.primaryRepository?.htmlUrl ? <a href={product.primaryRepository.htmlUrl} target="_blank" rel="noreferrer">{product.primaryRepository.fullName.replace("Yuichi-TanakaJP/", "")}</a> : <span className={styles.unregistered}>未登録</span>}</td><td><b>{product.relatedProductSlugs.length}</b><small> Product</small></td><td>{formatDate(product.updatedAt)}</td></tr>)}</tbody></table>{!portfolio.length ? <div className={styles.empty}>条件に一致するProductはありません。</div> : null}</div>
    </section>

    <section><Heading step="05 / CONTEXT" title="Portfolio context" description="Product判断を補助する構成情報。生テーブルではなく要約だけを見る。" /><div className={styles.context}><div><h3>Product mix</h3><p>どんな種類の資産に偏っているか。</p><Breakdown items={types} labels={TYPE} /></div><div><h3>Infrastructure footprint</h3><p>外部サービス依存の広がり。monitoringも含む登録ベース。</p><Breakdown items={providers} /></div><div><h3>Shared technology</h3><p>複数Productで再利用される主要スタック。</p><Breakdown items={technologies} /></div></div></section>

    <footer className={styles.footer}>この画面は「全体判断」が目的です。依存関係・Evidence・Technologyの詳細は <Link href="/premium/product-map">Product Map</Link> へ分離しています。</footer>
  </div></main>;
}
