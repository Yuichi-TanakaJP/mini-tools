"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  WorkspaceCoreApiResponse,
  WorkspaceCoreOverview,
  WorkspaceCoreProductDetail,
  WorkspaceCoreProductRelation,
  WorkspaceCoreProductSummary,
  WorkspaceCoreProviderLink,
} from "@/lib/workspace-core/types";
import { confidencePercent, providerImpactProducts, splitProviderLinks } from "./model";

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

async function fetchWorkspaceCore<T>(query: string): Promise<WorkspaceCoreApiResponse<T>> {
  const response = await fetch(`/api/premium/workspace-core?${query}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  return (await response.json()) as WorkspaceCoreApiResponse<T>;
}

function badgeStyle(background: string, color: string) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: 999,
    background,
    color,
    fontSize: 11,
    fontWeight: 850,
    lineHeight: 1.2,
  } as const;
}

function lifecycleTone(status: string) {
  if (status === "active") return { bg: "#dcfce7", fg: "#166534" };
  if (status === "experimental") return { bg: "#fef3c7", fg: "#92400e" };
  if (status === "archived") return { bg: "#e2e8f0", fg: "#475569" };
  if (status === "paused") return { bg: "#fee2e2", fg: "#991b1b" };
  return { bg: "#e0e7ff", fg: "#3730a3" };
}

function RelationCard({ relation, direction }: { relation: WorkspaceCoreProductRelation; direction: "incoming" | "outgoing" }) {
  const otherName = direction === "incoming" ? relation.sourceProductName : relation.targetProductName;
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        background: "#fff",
        borderRadius: 14,
        padding: "11px 12px",
        display: "grid",
        gap: 5,
        minWidth: 0,
      }}
    >
      <div style={{ fontWeight: 850, fontSize: 13, overflowWrap: "anywhere" }}>{otherName}</div>
      <div style={{ color: "#4f46e5", fontSize: 11, fontWeight: 800 }}>
        {RELATION_LABELS[relation.relationType] ?? relation.relationType}
      </div>
      <div style={{ color: "var(--color-text-sub)", fontSize: 10 }}>
        confidence {confidencePercent(relation.confidence)}
      </div>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--color-border)",
        borderRadius: 18,
        padding: "16px 17px",
        minHeight: 102,
        display: "grid",
        alignContent: "space-between",
        gap: 8,
      }}
    >
      <div style={{ color: "var(--color-text-sub)", fontSize: 12, fontWeight: 750 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -1 }}>{value}</div>
      <div style={{ color: "var(--color-text-sub)", fontSize: 10 }}>{note}</div>
    </div>
  );
}

export default function ProductMapClient() {
  const [overview, setOverview] = useState<WorkspaceCoreOverview | null>(null);
  const [detail, setDetail] = useState<WorkspaceCoreProductDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [detailLoading, setDetailLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceCore<WorkspaceCoreOverview>("mode=overview")
      .then((result) => {
        if (cancelled) return;
        if (result.status === "ok" && result.data) {
          setOverview(result.data);
          const preferred = result.data.products.find((product) => product.slug === "mini-tools") ?? result.data.products[0];
          setSelectedSlug(preferred?.slug ?? "");
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

  useEffect(() => {
    if (!selectedSlug || loadState !== "ok") return;
    let cancelled = false;
    fetchWorkspaceCore<WorkspaceCoreProductDetail>(`mode=product&slug=${encodeURIComponent(selectedSlug)}`)
      .then((result) => {
        if (cancelled) return;
        setDetail(result.status === "ok" ? result.data : null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlug, loadState]);

  const productBySlug = useMemo(
    () => new Map((overview?.products ?? []).map((product) => [product.slug, product])),
    [overview],
  );

  const providerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const link of overview?.providerLinks ?? []) map.set(link.providerSlug, link.providerName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [overview]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    let providerProducts: Set<string> | null = null;
    if (providerFilter !== "all" && overview) {
      providerProducts = new Set(
        overview.providerLinks.filter((link) => link.providerSlug === providerFilter).map((link) => link.productSlug),
      );
    }
    return (overview?.products ?? []).filter((product) => {
      if (typeFilter !== "all" && product.productType !== typeFilter) return false;
      if (providerProducts && !providerProducts.has(product.slug)) return false;
      if (!query) return true;
      return `${product.name} ${product.slug} ${product.description ?? ""}`.toLowerCase().includes(query);
    });
  }, [overview, providerFilter, search, typeFilter]);

  const totals = useMemo(() => {
    const products = overview?.products ?? [];
    return {
      products: products.length,
      repositories: products.reduce((sum, product) => sum + product.repositoryCount, 0),
      technologies: products.reduce((sum, product) => sum + product.technologyCount, 0),
      providers: new Set((overview?.providerLinks ?? []).map((link) => link.providerSlug)).size,
    };
  }, [overview]);

  const selectedProviderImpact = useMemo(() => {
    if (!overview || providerFilter === "all") return null;
    return providerImpactProducts(providerFilter, overview.providerLinks);
  }, [overview, providerFilter]);

  if (loadState !== "ok" || !overview) {
    return (
      <main style={{ padding: "32px 16px 72px" }}>
        <section style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 18 }}>
          <Link href="/premium" style={{ color: "var(--color-text-sub)", textDecoration: "none", fontWeight: 800 }}>
            ← Premium ホーム
          </Link>
          <div
            style={{
              borderRadius: 26,
              padding: "30px 24px",
              background: "linear-gradient(135deg, #0f172a, #312e81)",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 850, opacity: 0.72, marginBottom: 10 }}>WORKSPACE CORE</div>
            <h1 style={{ margin: 0, fontSize: 34 }}>Product Map</h1>
            <p style={{ margin: "12px 0 0", color: "rgba(255,255,255,.76)", lineHeight: 1.8 }}>
              {loadState === "loading" ? "開発資産の関係を読み込んでいます…" : message}
            </p>
          </div>
          {loadState === "unconfigured" ? (
            <div style={{ padding: 18, borderRadius: 18, background: "#fff7ed", border: "1px solid #fed7aa", lineHeight: 1.8 }}>
              Vercel / ローカル環境に server-only の Workspace Core 接続情報を設定すると、この画面が有効になります。
              ブラウザ用の <code>NEXT_PUBLIC_*</code> には設定しません。
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: "28px 14px 72px", background: "linear-gradient(#f8fafc, #fff 420px)" }}>
      <section style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 18 }}>
        <div
          style={{
            borderRadius: 28,
            padding: "26px 24px",
            color: "#fff",
            background:
              "radial-gradient(circle at 90% 10%, rgba(56,189,248,.28), transparent 30%), radial-gradient(circle at 5% 100%, rgba(168,85,247,.28), transparent 35%), linear-gradient(135deg,#0f172a 0%,#1e1b4b 52%,#312e81 100%)",
            boxShadow: "0 22px 55px rgba(15,23,42,.15)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ maxWidth: 760 }}>
              <Link href="/premium" style={{ color: "rgba(255,255,255,.7)", textDecoration: "none", fontSize: 12, fontWeight: 800 }}>
                ← Premium ホーム
              </Link>
              <div style={{ marginTop: 15, fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: "#a5b4fc" }}>
                WORKSPACE CORE / DEVELOPMENT MAP
              </div>
              <h1 style={{ margin: "7px 0 10px", fontSize: 34, lineHeight: 1.12, letterSpacing: -1.1 }}>Product Map</h1>
              <p style={{ margin: 0, lineHeight: 1.8, color: "rgba(255,255,255,.76)", fontSize: 14 }}>
                Productを中心にRepository・Technology・外部Service・Product間依存を横断します。根拠のある関係だけを表示し、監視対象はruntime依存と分離します。
              </p>
            </div>
            <div style={{ ...badgeStyle("rgba(34,197,94,.16)", "#bbf7d0"), border: "1px solid rgba(134,239,172,.28)" }}>
              ● Workspace Core connected
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <StatCard label="Products" value={totals.products} note="Product identity" />
          <StatCard label="Repositories" value={totals.repositories} note="mapped repositories" />
          <StatCard label="Technology links" value={totals.technologies} note="evidence-backed links" />
          <StatCard label="Providers" value={totals.providers} note="used / monitored providers" />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <aside
            style={{
              background: "#fff",
              border: "1px solid var(--color-border)",
              borderRadius: 22,
              padding: 14,
              display: "grid",
              gap: 12,
              flex: "0 1 340px",
              minWidth: 280,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Productを検索"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  padding: "0 12px",
                  background: "#f8fafc",
                  color: "var(--color-text)",
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 7 }}>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  style={{ height: 38, borderRadius: 11, border: "1px solid var(--color-border)", padding: "0 8px", background: "#fff" }}
                >
                  <option value="all">全Type</option>
                  {[...new Set(overview.products.map((product) => product.productType))].sort().map((type) => (
                    <option key={type} value={type}>{PRODUCT_TYPE_LABELS[type] ?? type}</option>
                  ))}
                </select>
                <select
                  value={providerFilter}
                  onChange={(event) => setProviderFilter(event.target.value)}
                  style={{ height: 38, borderRadius: 11, border: "1px solid var(--color-border)", padding: "0 8px", background: "#fff" }}
                >
                  <option value="all">全Provider</option>
                  {providerOptions.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
                </select>
              </div>
            </div>

            {selectedProviderImpact ? (
              <div style={{ borderRadius: 13, background: "#eef2ff", padding: 11, fontSize: 11, lineHeight: 1.6 }}>
                <strong>{providerOptions.find(([slug]) => slug === providerFilter)?.[1] ?? providerFilter}</strong>
                <div>runtime: {selectedProviderImpact.runtimeProducts.length} Product</div>
                <div>monitoring only: {selectedProviderImpact.monitoringProducts.length} Product</div>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 6, maxHeight: "68vh", overflowY: "auto", paddingRight: 2 }}>
              {filteredProducts.map((product) => {
                const active = product.slug === selectedSlug;
                const tone = lifecycleTone(product.lifecycleStatus);
                return (
                  <button
                    type="button"
                    key={product.slug}
                    onClick={() => setSelectedSlug(product.slug)}
                    style={{
                      textAlign: "left",
                      border: active ? "1px solid #818cf8" : "1px solid transparent",
                      background: active ? "#eef2ff" : "#fff",
                      borderRadius: 14,
                      padding: "11px 12px",
                      cursor: "pointer",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 900, color: active ? "#312e81" : "var(--color-text)", overflowWrap: "anywhere" }}>{product.name}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <span style={badgeStyle("#f1f5f9", "#475569")}>{PRODUCT_TYPE_LABELS[product.productType] ?? product.productType}</span>
                      <span style={badgeStyle(tone.bg, tone.fg)}>{product.lifecycleStatus}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-sub)" }}>
                      {product.repositoryCount} repo · {product.technologyCount} tech · {product.providerCount} provider
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section style={{ minWidth: 0, display: "grid", gap: 14, flex: "1 1 560px" }}>
            {detailLoading && !detail ? (
              <div style={{ padding: 24, borderRadius: 20, background: "#fff", border: "1px solid var(--color-border)" }}>読み込み中…</div>
            ) : detail ? (
              <ProductDetail detail={detail} productBySlug={productBySlug} onSelectProduct={setSelectedSlug} />
            ) : (
              <div style={{ padding: 24, borderRadius: 20, background: "#fff", border: "1px solid var(--color-border)" }}>Product詳細を取得できませんでした。</div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function ProductDetail({
  detail,
  productBySlug,
  onSelectProduct,
}: {
  detail: WorkspaceCoreProductDetail;
  productBySlug: Map<string, WorkspaceCoreProductSummary>;
  onSelectProduct: (slug: string) => void;
}) {
  const { runtime, monitoring } = splitProviderLinks(detail.providers);
  const lifecycle = lifecycleTone(detail.product.lifecycleStatus);

  return (
    <>
      <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 22, padding: "20px 20px 18px", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#6366f1", fontSize: 11, fontWeight: 900 }}>{detail.product.slug}</div>
            <h2 style={{ margin: "4px 0 6px", fontSize: 27, letterSpacing: -.6 }}>{detail.product.name}</h2>
            <p style={{ margin: 0, color: "var(--color-text-sub)", fontSize: 13, lineHeight: 1.7, maxWidth: 760 }}>
              {detail.product.description || "説明はまだ登録されていません。"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={badgeStyle("#eef2ff", "#3730a3")}>{PRODUCT_TYPE_LABELS[detail.product.productType] ?? detail.product.productType}</span>
            <span style={badgeStyle(lifecycle.bg, lifecycle.fg)}>{detail.product.lifecycleStatus}</span>
            <span style={badgeStyle("#f8fafc", "#475569")}>importance {detail.product.importance}</span>
          </div>
        </div>
      </div>

      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 22, padding: 16, display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 15 }}>1-hop Product Map</div>
          <div style={{ color: "var(--color-text-sub)", fontSize: 11, marginTop: 3 }}>Product間の確認済みrelationのみ。Provider監視はここには混ぜません。</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 7 }}>
            <div style={{ fontSize: 10, color: "var(--color-text-sub)", fontWeight: 850 }}>INCOMING</div>
            {detail.incomingRelations.length ? detail.incomingRelations.map((relation) => (
              <button key={`${relation.sourceProductSlug}-${relation.relationType}`} type="button" onClick={() => onSelectProduct(relation.sourceProductSlug)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}>
                <RelationCard relation={relation} direction="incoming" />
              </button>
            )) : <div style={{ color: "var(--color-text-sub)", fontSize: 11 }}>なし</div>}
          </div>

          <div style={{ borderRadius: 18, padding: "18px 12px", textAlign: "center", background: "linear-gradient(135deg,#312e81,#4f46e5)", color: "#fff", boxShadow: "0 12px 30px rgba(79,70,229,.18)" }}>
            <div style={{ fontSize: 10, opacity: .7 }}>SELECTED</div>
            <div style={{ marginTop: 5, fontWeight: 950, overflowWrap: "anywhere" }}>{detail.product.name}</div>
          </div>

          <div style={{ display: "grid", gap: 7 }}>
            <div style={{ fontSize: 10, color: "var(--color-text-sub)", fontWeight: 850 }}>OUTGOING</div>
            {detail.outgoingRelations.length ? detail.outgoingRelations.map((relation) => (
              <button key={`${relation.targetProductSlug}-${relation.relationType}`} type="button" onClick={() => onSelectProduct(relation.targetProductSlug)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}>
                <RelationCard relation={relation} direction="outgoing" />
              </button>
            )) : <div style={{ color: "var(--color-text-sub)", fontSize: 11 }}>なし</div>}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
        <AssetPanel title={`Repositories · ${detail.repositories.length}`}>
          {detail.repositories.length ? detail.repositories.map((repo) => (
            <div key={repo.repositoryId} style={{ padding: "10px 0", borderBottom: "1px solid #eef2f7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                {repo.htmlUrl ? <a href={repo.htmlUrl} target="_blank" rel="noreferrer" style={{ color: "#4338ca", fontWeight: 850, textDecoration: "none", overflowWrap: "anywhere" }}>{repo.fullName}</a> : <strong>{repo.fullName}</strong>}
                {repo.isPrimary ? <span style={badgeStyle("#dcfce7", "#166534")}>primary</span> : null}
              </div>
              <div style={{ color: "var(--color-text-sub)", fontSize: 10, marginTop: 5 }}>{repo.visibility} · {repo.defaultBranch ?? "branch ?"} · {repo.role}</div>
            </div>
          )) : <Empty />}
        </AssetPanel>

        <AssetPanel title={`Technologies · ${detail.technologies.length}`}>
          {detail.technologies.length ? detail.technologies.map((tech) => (
            <div key={tech.technologyId} style={{ padding: "10px 0", borderBottom: "1px solid #eef2f7", display: "grid", gap: 5 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{tech.technologyName}</strong>
                <span style={badgeStyle("#f1f5f9", "#475569")}>{tech.category}</span>
                {tech.version ? <span style={{ fontSize: 10, color: "var(--color-text-sub)" }}>{tech.version}</span> : null}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-sub)" }}>{tech.role ?? "role未設定"} · confidence {confidencePercent(tech.confidence)}</div>
              {tech.evidenceUri ? <a href={tech.evidenceUri} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#4f46e5", textDecoration: "none" }}>Evidence ↗</a> : null}
            </div>
          )) : <Empty />}
        </AssetPanel>

        <AssetPanel title={`Runtime services · ${runtime.length + detail.serviceInstances.length}`}>
          {detail.serviceInstances.map((instance) => (
            <div key={instance.serviceInstanceId} style={{ padding: "10px 0", borderBottom: "1px solid #eef2f7", display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                <strong>{instance.providerName}</strong>
                <span style={badgeStyle("#dbeafe", "#1d4ed8")}>concrete instance</span>
              </div>
              <div style={{ fontSize: 11 }}>{instance.instanceName}</div>
              <div style={{ fontSize: 10, color: "var(--color-text-sub)" }}>{instance.relationType} · {instance.environment} · {instance.region ?? "region ?"}</div>
            </div>
          ))}
          {runtime.map((link) => <ProviderRow key={`${link.providerId}-${link.relationType}`} link={link} />)}
          {!runtime.length && !detail.serviceInstances.length ? <Empty /> : null}
        </AssetPanel>

        <AssetPanel title={`Monitoring targets · ${monitoring.length}`} tone="monitoring">
          {monitoring.length ? monitoring.map((link) => <ProviderRow key={`${link.providerId}-${link.relationType}`} link={link} monitoring />) : <Empty />}
        </AssetPanel>
      </div>

      {detail.incomingRelations.length || detail.outgoingRelations.length ? (
        <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: 20, padding: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Relation provenance</div>
          {[...detail.outgoingRelations, ...detail.incomingRelations].map((relation, index) => {
            const otherSlug = relation.sourceProductSlug === detail.product.slug ? relation.targetProductSlug : relation.sourceProductSlug;
            return (
              <div key={`${otherSlug}-${relation.relationType}-${index}`} style={{ padding: "9px 0", borderTop: index ? "1px solid #eef2f7" : 0, fontSize: 11, lineHeight: 1.6 }}>
                <button type="button" onClick={() => onSelectProduct(otherSlug)} style={{ border: 0, padding: 0, background: "transparent", color: "#4338ca", fontWeight: 850, cursor: "pointer" }}>
                  {productBySlug.get(otherSlug)?.name ?? otherSlug}
                </button>
                <span style={{ color: "var(--color-text-sub)" }}> · {RELATION_LABELS[relation.relationType] ?? relation.relationType} · {relation.source} · confidence {confidencePercent(relation.confidence)}</span>
                {relation.notes ? <div style={{ color: "var(--color-text-sub)" }}>{relation.notes}</div> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function ProviderRow({ link, monitoring = false }: { link: WorkspaceCoreProviderLink; monitoring?: boolean }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #eef2f7", display: "grid", gap: 4 }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        <strong>{link.providerName}</strong>
        <span style={badgeStyle(monitoring ? "#fef3c7" : "#e0e7ff", monitoring ? "#92400e" : "#3730a3")}>
          {PROVIDER_RELATION_LABELS[link.relationType] ?? link.relationType}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "var(--color-text-sub)" }}>{link.providerCategory} · confidence {confidencePercent(link.confidence)}</div>
      {link.evidenceUri ? <a href={link.evidenceUri} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#4f46e5", textDecoration: "none" }}>Evidence ↗</a> : null}
      {monitoring ? <div style={{ fontSize: 10, color: "#92400e" }}>監視対象であり、このProductのruntime dependencyとは扱いません。</div> : null}
    </div>
  );
}

function AssetPanel({ children, title, tone = "default" }: { children: ReactNode; title: string; tone?: "default" | "monitoring" }) {
  return (
    <div style={{ background: tone === "monitoring" ? "#fffbeb" : "#fff", border: `1px solid ${tone === "monitoring" ? "#fde68a" : "var(--color-border)"}`, borderRadius: 20, padding: 15, minWidth: 0 }}>
      <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 5 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Empty() {
  return <div style={{ color: "var(--color-text-sub)", fontSize: 11, padding: "12px 0" }}>登録なし</div>;
}
