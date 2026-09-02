"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  WorkspaceCoreApiResponse,
  WorkspaceCoreOverview,
  WorkspaceCoreProductSummary,
} from "@/lib/workspace-core/types";
import { isMonitoringRelation } from "../model";
import {
  buildProductRows,
  dashboardTotals,
  filterWorkspaceOverview,
  providerUsage,
  technologyUsage,
  type UsageBreakdown,
} from "../dashboard-model";
import styles from "./WorkspaceDashboard.module.css";

type LoadState = "loading" | "ok" | "unconfigured" | "error";

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  application: "Application",
  service: "Service",
  automation: "Automation",
  library: "Library",
  infrastructure: "Infrastructure",
  knowledge: "Knowledge",
  experiment: "Experiment",
  other: "Other",
};

const RELATION_LABELS: Record<string, string> = {
  consumes_api: "API利用",
  consumes_data: "Data利用",
  consumes_content: "Content利用",
  uses_workflow_asset: "Workflow利用",
  references_source_of_truth: "SoT参照",
};

const PROVIDER_RELATION_LABELS: Record<string, string> = {
  uses_database_platform: "DB platform",
  uses_object_storage: "Object storage",
  deployment_target: "Deploy",
  uses_ai_api: "AI API",
  uses_ai_cli: "AI CLI",
  uses_vector_database: "Vector DB",
  uses_messaging_api: "Messaging API",
  consumes_content_api: "Content API",
  uses_market_data_api: "Market data API",
  monitors_service: "監視対象",
};

async function fetchOverview(): Promise<WorkspaceCoreApiResponse<WorkspaceCoreOverview>> {
  const response = await fetch("/api/premium/workspace-core?mode=overview", {
    credentials: "same-origin",
    cache: "no-store",
  });
  return (await response.json()) as WorkspaceCoreApiResponse<WorkspaceCoreOverview>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricNote}>{note}</div>
    </div>
  );
}

function lifecycleClass(status: string): string {
  if (status === "active") return styles.pillActive;
  if (status === "experimental") return styles.pillExperimental;
  if (status === "archived") return styles.pillArchived;
  return "";
}

function PanelHeader({ title, description, count }: { title: string; description: string; count?: number }) {
  return (
    <div className={styles.panelHeader}>
      <div>
        <h2 className={styles.panelTitle}>{title}</h2>
        <p className={styles.panelDescription}>{description}</p>
      </div>
      {typeof count === "number" ? <span className={styles.countBadge}>{count}</span> : null}
    </div>
  );
}

function UsagePanel({
  title,
  description,
  items,
  showMonitoring = false,
}: {
  title: string;
  description: string;
  items: UsageBreakdown[];
  showMonitoring?: boolean;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className={styles.panel}>
      <PanelHeader title={title} description={description} count={items.length} />
      {items.length ? (
        <div className={styles.usageList}>
          {items.map((item) => (
            <div className={styles.usageRow} key={item.slug} title={item.products.join(", ")}>
              <div className={styles.usageName}>
                {item.name}
                {showMonitoring && item.monitoringCount ? (
                  <span className={`${styles.pill} ${styles.pillMonitoring}`} style={{ marginLeft: 6 }}>
                    monitor {item.monitoringCount}
                  </span>
                ) : null}
              </div>
              <div className={styles.barTrack} aria-hidden="true">
                <div className={styles.barFill} style={{ width: `${Math.max(5, (item.count / max) * 100)}%` }} />
              </div>
              <div className={styles.usageCount}>{item.count}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>該当データはありません。</div>
      )}
    </section>
  );
}

function ProductFocus({ overview, product }: { overview: WorkspaceCoreOverview; product: WorkspaceCoreProductSummary | null }) {
  if (!product) {
    return (
      <section className={styles.panel}>
        <PanelHeader title="Product focus" description="一覧からProductを選ぶと、その周辺をここで確認できます。" />
        <div className={styles.empty}>Productを選択してください。</div>
      </section>
    );
  }

  const repositories = overview.repositories.filter((link) => link.productSlug === product.slug);
  const technologies = overview.technologies.filter((link) => link.productSlug === product.slug);
  const providers = overview.providerLinks.filter((link) => link.productSlug === product.slug);
  const runtimeProviders = providers.filter((link) => !isMonitoringRelation(link.relationType));
  const monitoringProviders = providers.filter((link) => isMonitoringRelation(link.relationType));
  const relations = overview.relations.filter(
    (relation) => relation.sourceProductSlug === product.slug || relation.targetProductSlug === product.slug,
  );

  return (
    <section className={styles.panel}>
      <PanelHeader title="Product focus" description="横断一覧から1 Productだけを短く切り出したQuick viewです。" />
      <div className={styles.focusBody}>
        <div className={styles.focusTitleRow}>
          <div>
            <h3 className={styles.focusTitle}>{product.name}</h3>
            <p className={styles.focusDescription}>{product.description ?? product.slug}</p>
          </div>
          <span className={`${styles.pill} ${lifecycleClass(product.lifecycleStatus)}`}>{product.lifecycleStatus}</span>
        </div>

        <div className={styles.focusGrid}>
          <div className={styles.focusBlock}>
            <div className={styles.focusLabel}>Repositories</div>
            <div className={styles.chipList}>
              {repositories.map((link) => <span className={styles.chip} key={link.repositoryId}>{link.fullName}</span>)}
              {!repositories.length ? <span className={styles.muted}>none</span> : null}
            </div>
          </div>
          <div className={styles.focusBlock}>
            <div className={styles.focusLabel}>Technologies</div>
            <div className={styles.chipList}>
              {technologies.map((link) => <span className={styles.chip} key={`${link.technologyId}-${link.productSlug}`}>{link.technologyName}</span>)}
              {!technologies.length ? <span className={styles.muted}>none</span> : null}
            </div>
          </div>
          <div className={styles.focusBlock}>
            <div className={styles.focusLabel}>Runtime providers</div>
            <div className={styles.chipList}>
              {runtimeProviders.map((link) => <span className={styles.chip} key={`${link.providerId}-${link.relationType}`}>{link.providerName}</span>)}
              {!runtimeProviders.length ? <span className={styles.muted}>none</span> : null}
            </div>
          </div>
          <div className={styles.focusBlock}>
            <div className={styles.focusLabel}>Monitoring targets</div>
            <div className={styles.chipList}>
              {monitoringProviders.map((link) => <span className={styles.chip} key={`${link.providerId}-${link.relationType}`}>{link.providerName}</span>)}
              {!monitoringProviders.length ? <span className={styles.muted}>none</span> : null}
            </div>
          </div>
        </div>

        <div className={styles.focusBlock}>
          <div className={styles.focusLabel}>Product relations</div>
          <div className={styles.chipList}>
            {relations.map((relation) => {
              const outgoing = relation.sourceProductSlug === product.slug;
              const other = outgoing ? relation.targetProductName : relation.sourceProductName;
              return (
                <span className={styles.chip} key={`${relation.sourceProductSlug}-${relation.targetProductSlug}-${relation.relationType}`}>
                  {outgoing ? "→" : "←"} {other} · {RELATION_LABELS[relation.relationType] ?? relation.relationType}
                </span>
              );
            })}
            {!relations.length ? <span className={styles.muted}>none</span> : null}
          </div>
        </div>

        <div>
          <Link className={styles.subtleLink} href="/premium/product-map">Product Mapで詳細を見る →</Link>
        </div>
      </div>
    </section>
  );
}

export default function WorkspaceDashboardClient() {
  const [overview, setOverview] = useState<WorkspaceCoreOverview | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [productType, setProductType] = useState("all");
  const [lifecycle, setLifecycle] = useState("all");
  const [providerSlug, setProviderSlug] = useState("all");
  const [focusedSlug, setFocusedSlug] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchOverview()
      .then((result) => {
        if (cancelled) return;
        if (result.status === "ok" && result.data) {
          setOverview(result.data);
          setLoadState("ok");
          return;
        }
        setMessage(result.message ?? "Workspace Coreを取得できませんでした。");
        setLoadState(result.status === "unconfigured" ? "unconfigured" : "error");
      })
      .catch(() => {
        if (cancelled) return;
        setMessage("Workspace Core APIへの接続に失敗しました。");
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scope = useMemo(() => {
    if (!overview) return null;
    return filterWorkspaceOverview(overview, { query, productType, lifecycle, providerSlug });
  }, [overview, query, productType, lifecycle, providerSlug]);

  const productRows = useMemo(() => (scope ? buildProductRows(scope) : []), [scope]);
  const totals = useMemo(() => (scope ? dashboardTotals(scope) : null), [scope]);
  const technologies = useMemo(() => (scope ? technologyUsage(scope) : []), [scope]);
  const providers = useMemo(() => (scope ? providerUsage(scope) : []), [scope]);

  const providerOptions = useMemo(() => {
    if (!overview) return [];
    const map = new Map<string, string>();
    for (const link of overview.providerLinks) map.set(link.providerSlug, link.providerName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [overview]);

  const productTypes = useMemo(
    () => [...new Set((overview?.products ?? []).map((product) => product.productType))].sort(),
    [overview],
  );
  const lifecycleOptions = useMemo(
    () => [...new Set((overview?.products ?? []).map((product) => product.lifecycleStatus))].sort(),
    [overview],
  );

  const focusedProduct = useMemo(() => {
    if (!overview) return null;
    return overview.products.find((product) => product.slug === focusedSlug) ?? scope?.products[0] ?? null;
  }, [focusedSlug, overview, scope]);

  if (loadState !== "ok" || !overview || !scope || !totals) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.topbar}>
            <Link className={styles.link} href="/premium">← Premium ホーム</Link>
          </div>
          {loadState === "loading" ? (
            <div className={styles.loadingCard}>Workspace Coreの横断データを読み込んでいます…</div>
          ) : (
            <div className={styles.errorCard}>
              {message}
              {loadState === "unconfigured" ? " server-onlyのWorkspace Core接続設定を確認してください。" : ""}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div className={styles.breadcrumbs}>
            <Link className={styles.link} href="/premium">Premium</Link>
            <span className={styles.muted}>/</span>
            <Link className={styles.link} href="/premium/product-map">Product Map</Link>
            <span className={styles.muted}>/ Dashboard</span>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.subtleLink} href="/premium/product-map">Product Map</Link>
          </div>
        </div>

        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Workspace Core / Overview</div>
            <h1 className={styles.title}>Workspace Dashboard</h1>
            <p className={styles.subtitle}>
              Productを軸に、Repository・Technology・Provider・Service Instance・Product relationを同じ画面で横断します。
              上のフィルタは全セクションに連動し、一覧から詳細へ降りられます。
            </p>
          </div>
          <div className={styles.connected}><span className={styles.connectedDot} />connected</div>
        </header>

        <section className={styles.metrics} aria-label="Workspace metrics">
          <Metric label="Products" value={totals.products} note={`${totals.activeProducts} active`} />
          <Metric label="Repositories" value={totals.repositories} note="mapped repositories" />
          <Metric label="Technologies" value={totals.technologies} note="unique stack" />
          <Metric label="Providers" value={totals.providers} note="runtime + monitoring" />
          <Metric label="Relations" value={totals.relations} note="1-hop product links" />
          <Metric label="Instances" value={scope.serviceInstances.length} note="concrete services" />
        </section>

        <section className={styles.toolbar} aria-label="Dashboard filters">
          <input
            className={styles.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Product / Repo / Technology / Provider を検索"
            aria-label="Workspace横断検索"
          />
          <select className={styles.select} value={productType} onChange={(event) => setProductType(event.target.value)} aria-label="Product type">
            <option value="all">全Type</option>
            {productTypes.map((type) => <option key={type} value={type}>{PRODUCT_TYPE_LABELS[type] ?? type}</option>)}
          </select>
          <select className={styles.select} value={lifecycle} onChange={(event) => setLifecycle(event.target.value)} aria-label="Lifecycle">
            <option value="all">全Lifecycle</option>
            {lifecycleOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select className={styles.select} value={providerSlug} onChange={(event) => setProviderSlug(event.target.value)} aria-label="Provider">
            <option value="all">全Provider</option>
            {providerOptions.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.stack}>
            <section className={styles.panel}>
              <PanelHeader title="Product inventory" description="全Productの状態と接続密度を一行で比較します。Product名を押すとQuick viewを切り替えます。" count={productRows.length} />
              {productRows.length ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Repo</th>
                        <th>Tech</th>
                        <th>Runtime</th>
                        <th>Monitor</th>
                        <th>Relations</th>
                        <th>Importance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map((product) => (
                        <tr key={product.slug}>
                          <td>
                            <button className={styles.productButton} type="button" onClick={() => setFocusedSlug(product.slug)}>{product.name}</button>
                            <div className={styles.productSlug}>{product.slug}</div>
                          </td>
                          <td><span className={styles.pill}>{PRODUCT_TYPE_LABELS[product.productType] ?? product.productType}</span></td>
                          <td><span className={`${styles.pill} ${lifecycleClass(product.lifecycleStatus)}`}>{product.lifecycleStatus}</span></td>
                          <td>{product.repositoryCount}</td>
                          <td>{product.technologyCount}</td>
                          <td>{product.runtimeProviderCount}</td>
                          <td>{product.monitoringProviderCount || "–"}</td>
                          <td>{product.relationCount}</td>
                          <td>{product.importance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.empty}>条件に一致するProductはありません。</div>
              )}
            </section>

            <section className={styles.panel}>
              <PanelHeader title="Repository inventory" description="ProductとRepositoryのmany-to-many対応を一覧します。" count={scope.repositories.length} />
              {scope.repositories.length ? (
                <div className={styles.repoList}>
                  {scope.repositories.map((repository) => (
                    <div className={styles.repoItem} key={`${repository.productSlug}-${repository.repositoryId}`}>
                      <div className={styles.repoMain}>
                        <div className={styles.repoTitle}>{repository.fullName}</div>
                        <div className={styles.metaLine}>
                          {repository.productSlug} · {repository.role} · {repository.visibility}{repository.isPrimary ? " · primary" : ""}{repository.archived ? " · archived" : ""}
                        </div>
                      </div>
                      {repository.htmlUrl ? <a className={styles.externalLink} href={repository.htmlUrl} target="_blank" rel="noreferrer">GitHub ↗</a> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>Repositoryはありません。</div>
              )}
            </section>
          </div>

          <aside className={styles.stack}>
            <ProductFocus overview={overview} product={focusedProduct} />
            <UsagePanel title="Technology landscape" description="複数Productで共有されている技術ほど長く表示します。" items={technologies} />
            <UsagePanel title="Provider landscape" description="利用先と監視対象を同じProvider軸で比較し、監視件数は別表示します。" items={providers} showMonitoring />
          </aside>
        </div>

        <div className={styles.sectionGrid}>
          <section className={styles.panel}>
            <PanelHeader title="Product relations" description="登録済みのProduct間1-hop relationをすべて表示します。" count={scope.relations.length} />
            {scope.relations.length ? (
              <div className={styles.relationList}>
                {scope.relations.map((relation) => (
                  <div className={styles.relationItem} key={`${relation.sourceProductSlug}-${relation.targetProductSlug}-${relation.relationType}`}>
                    <div className={styles.relationMain}>
                      <div className={styles.relationTitle}>{relation.sourceProductName} → {relation.targetProductName}</div>
                      <div className={styles.metaLine}>{RELATION_LABELS[relation.relationType] ?? relation.relationType} · confidence {Math.round(relation.confidence * 100)}%</div>
                    </div>
                    <span className={styles.pill}>{relation.source}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>Product relationはありません。</div>
            )}
          </section>

          <section className={styles.panel}>
            <PanelHeader title="Concrete service instances" description="Providerという概念ではなく、実体として確認済みのService Instanceだけを表示します。" count={scope.serviceInstances.length} />
            {scope.serviceInstances.length ? (
              <div className={styles.instanceList}>
                {scope.serviceInstances.map((instance) => (
                  <div className={styles.instanceItem} key={instance.serviceInstanceId}>
                    <div className={styles.instanceMain}>
                      <div className={styles.instanceTitle}>{instance.instanceName}</div>
                      <div className={styles.metaLine}>{instance.productSlug} · {instance.providerName} · {instance.environment}{instance.region ? ` · ${instance.region}` : ""} · {instance.status}</div>
                    </div>
                    {instance.url ? <a className={styles.externalLink} href={instance.url} target="_blank" rel="noreferrer">Open ↗</a> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>このscopeにConcrete Instanceはありません。</div>
            )}
          </section>
        </div>

        <section className={styles.panel}>
          <PanelHeader title="Provider relations" description="runtime利用とmonitoring targetをRelation単位で確認します。" count={scope.providerLinks.length} />
          {scope.providerLinks.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Provider</th>
                    <th>Relation</th>
                    <th>Category</th>
                    <th>Confidence</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {scope.providerLinks.map((link) => (
                    <tr key={`${link.productSlug}-${link.providerSlug}-${link.relationType}`}>
                      <td>{link.productSlug}</td>
                      <td>{link.providerName}</td>
                      <td>
                        <span className={`${styles.pill} ${isMonitoringRelation(link.relationType) ? styles.pillMonitoring : ""}`}>
                          {PROVIDER_RELATION_LABELS[link.relationType] ?? link.relationType}
                        </span>
                      </td>
                      <td>{link.providerCategory}</td>
                      <td>{Math.round(link.confidence * 100)}%</td>
                      <td>{link.evidenceUri ? <a className={styles.externalLink} href={link.evidenceUri} target="_blank" rel="noreferrer">Evidence ↗</a> : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>Provider relationはありません。</div>
          )}
        </section>
      </div>
    </main>
  );
}
