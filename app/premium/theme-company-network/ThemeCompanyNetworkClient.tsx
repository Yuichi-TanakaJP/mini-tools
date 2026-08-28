"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ThemeCompanyNetworkLoadResult, ThemeCompanyRelationship, ThemeDirectCompany } from "./data-loader";

function formatPct(value: number | null) {
  if (value === null) return "";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(date);
}

function relationLabel(relation: ThemeCompanyRelationship) {
  const labels: Record<string, string> = {
    equity_ownership: "出資",
    parent_of: "親会社",
    controls: "支配",
    equity_method_investment: "持分法",
    spun_off: "分社",
    predecessor_of: "前身",
    merged_into: "統合",
  };
  const base = labels[relation.relationType] ?? relation.relationType;
  const pct = formatPct(relation.ownershipPct);
  return pct ? `${base} ${pct}` : base;
}

type RelatedRow = {
  direct: ThemeDirectCompany;
  relatedCompanyId: string;
  relatedCompanyName: string;
  relatedIsAlsoDirect: boolean;
  relationship: ThemeCompanyRelationship;
};

export default function ThemeCompanyNetworkClient({ result }: { result: ThemeCompanyNetworkLoadResult }) {
  const data = result.data;
  const defaultThemeId = useMemo(() => {
    if (!data) return "";
    const verifiedDirect = data.directCompanies.filter((link) => link.sourceStatus === "verified");
    const withRelationship = data.themes.find((theme) =>
      verifiedDirect.some((link) =>
        link.themeId === theme.id &&
        data.relationships.some(
          (relationship) =>
            relationship.verificationStatus === "verified" &&
            (relationship.sourceCompanyId === link.companyId || relationship.targetCompanyId === link.companyId),
        ),
      ),
    );
    return withRelationship?.id ?? data.themes[0]?.id ?? "";
  }, [data]);

  const [selectedThemeId, setSelectedThemeId] = useState(defaultThemeId);
  const [includeProposed, setIncludeProposed] = useState(false);

  const directCompanies = useMemo(() => {
    if (!data || !selectedThemeId) return [];
    return data.directCompanies
      .filter((link) => link.themeId === selectedThemeId)
      .filter((link) => link.sourceStatus === "verified" || (includeProposed && link.sourceStatus === "proposed"))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"));
  }, [data, selectedThemeId, includeProposed]);

  const relatedRows = useMemo<RelatedRow[]>(() => {
    if (!data) return [];
    const directIds = new Set(directCompanies.map((company) => company.companyId));
    const seen = new Set<string>();
    const rows: RelatedRow[] = [];

    for (const direct of directCompanies) {
      for (const relationship of data.relationships) {
        if (relationship.verificationStatus !== "verified" && !(includeProposed && relationship.verificationStatus === "proposed")) continue;
        const directIsSource = relationship.sourceCompanyId === direct.companyId;
        const directIsTarget = relationship.targetCompanyId === direct.companyId;
        if (!directIsSource && !directIsTarget) continue;

        const relatedCompanyId = directIsSource ? relationship.targetCompanyId : relationship.sourceCompanyId;
        const relatedCompanyName = directIsSource ? relationship.targetCompanyName : relationship.sourceCompanyName;
        const key = `${direct.companyId}:${relationship.relationId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          direct,
          relatedCompanyId,
          relatedCompanyName,
          relatedIsAlsoDirect: directIds.has(relatedCompanyId),
          relationship,
        });
      }
    }

    return rows.sort((a, b) => a.relatedCompanyName.localeCompare(b.relatedCompanyName, "ja"));
  }, [data, directCompanies, includeProposed]);

  if (!data) {
    return (
      <main style={{ padding: "28px 16px 72px" }}>
        <section style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
          <Link href="/premium" style={{ color: "var(--color-text-sub)", textDecoration: "none", fontWeight: 800 }}>← Premium ホーム</Link>
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 20 }}>
            <h1 style={{ margin: 0 }}>テーマ × 企業関係</h1>
            <p style={{ color: "var(--color-text-sub)", lineHeight: 1.8 }}>{result.message}</p>
          </div>
        </section>
      </main>
    );
  }

  const selectedTheme = data.themes.find((theme) => theme.id === selectedThemeId) ?? data.themes[0] ?? null;

  return (
    <main style={{ padding: "28px 16px 72px" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
        <nav style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/premium" style={{ color: "var(--color-text-sub)", textDecoration: "none", fontWeight: 800 }}>← Premium ホーム</Link>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href="/premium/industry-map" style={{ color: "var(--color-text-sub)", textDecoration: "none", fontWeight: 800 }}>業界マップ</Link>
            <Link href="/premium/company-network" style={{ color: "var(--color-text-sub)", textDecoration: "none", fontWeight: 800 }}>企業関係マップ</Link>
          </div>
        </nav>

        <header style={{ background: "linear-gradient(135deg, #172554 0%, #312e81 52%, #5b21b6 100%)", color: "white", borderRadius: 22, padding: "24px 22px" }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.5, opacity: 0.8 }}>FACT LAYER CROSS EXPLORER</div>
          <h1 style={{ margin: "7px 0 8px", fontSize: 30 }}>テーマ → 企業 → 関係企業</h1>
          <p style={{ margin: 0, maxWidth: 800, lineHeight: 1.8, color: "rgba(255,255,255,0.82)" }}>
            テーマへ直接つながる企業と、その企業から資本・支配・歴史的関係で見つかる企業を分けて表示します。間接企業をテーマ受益企業とは自動判定しません。
          </p>
        </header>

        <section style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 16, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, minWidth: 280, flex: "1 1 360px" }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-muted)" }}>テーマ</span>
            <select value={selectedThemeId} onChange={(event) => setSelectedThemeId(event.target.value)} style={{ minHeight: 42, borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-bg-input)", color: "var(--color-text)", padding: "0 10px" }}>
              {data.themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 42, fontSize: 13, fontWeight: 800 }}>
            <input type="checkbox" checked={includeProposed} onChange={(event) => setIncludeProposed(event.target.checked)} />
            proposedも表示
          </label>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(220px, 0.8fr) minmax(280px, 1fr) minmax(320px, 1.25fr)", gap: 14, alignItems: "start" }}>
          <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#4338ca" }}>THEME</div>
            <h2 style={{ margin: "6px 0 4px", fontSize: 19 }}>{selectedTheme?.name ?? "—"}</h2>
            <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{directCompanies.length} 直接企業</div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-muted)" }}>直接テーマ企業</div>
            {directCompanies.length > 0 ? directCompanies.map((company) => (
              <article key={company.linkId} style={{ background: "var(--color-bg-card)", border: "2px solid #818cf8", borderRadius: 14, padding: 15 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{company.companyName}</strong>
                  <span style={{ fontSize: 11, fontWeight: 900 }}>{company.sourceStatus}</span>
                </div>
                <div style={{ marginTop: 7, color: "var(--color-text-sub)", fontSize: 12 }}>theme relation: {company.relationType ?? "—"}</div>
                <div style={{ marginTop: 5, color: "var(--color-text-muted)", fontSize: 11 }}>source {formatDate(company.sourceAsOf)} / confidence {company.confidence ?? "—"}</div>
                {company.sourceUrl ? <a href={company.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, color: "var(--color-accent)", fontSize: 12, fontWeight: 800 }}>テーマ根拠を見る ↗</a> : null}
              </article>
            )) : (
              <div style={{ border: "1px dashed var(--color-border)", borderRadius: 12, padding: 14, color: "var(--color-text-sub)", lineHeight: 1.7 }}>この条件で根拠確認済みの直接企業はありません。</div>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-muted)" }}>企業関係で見つかった企業</div>
            {relatedRows.length > 0 ? relatedRows.map((row) => {
              const relationship = row.relationship;
              const directionText = relationship.sourceCompanyId === row.direct.companyId
                ? `${row.direct.companyName} → ${row.relatedCompanyName}`
                : `${row.relatedCompanyName} → ${row.direct.companyName}`;
              return (
                <article key={`${row.direct.companyId}:${relationship.relationId}`} style={{ background: "var(--color-bg-card)", border: relationship.verificationStatus === "verified" ? "1px solid var(--color-border)" : "1px dashed #a78bfa", borderRadius: 14, padding: 15 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong>{row.relatedCompanyName}</strong>
                    <span style={{ fontSize: 11, fontWeight: 900 }}>{relationship.verificationStatus}</span>
                  </div>
                  {row.relatedIsAlsoDirect ? <div style={{ marginTop: 5, fontSize: 11, fontWeight: 800, color: "#4338ca" }}>この企業は直接テーマ企業でもあります</div> : null}
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800 }}>{directionText}</div>
                  <div style={{ marginTop: 5, color: "var(--color-text-sub)", fontSize: 12 }}>{relationLabel(relationship)} / {relationship.relationCategory}</div>
                  <div style={{ marginTop: 5, color: "var(--color-text-muted)", fontSize: 11 }}>source {formatDate(relationship.sourceAsOf)} / confidence {relationship.confidence}</div>
                  <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "var(--color-bg-input)", color: "var(--color-text-sub)", fontSize: 11, lineHeight: 1.6 }}>
                    これは企業関係の事実です。{row.relatedCompanyName}が「{selectedTheme?.name ?? "このテーマ"}」の受益企業であることを意味しません。
                  </div>
                  {relationship.sourceUrl ? <a href={relationship.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, color: "var(--color-accent)", fontSize: 12, fontWeight: 800 }}>企業関係の根拠を見る ↗</a> : null}
                </article>
              );
            }) : (
              <div style={{ border: "1px dashed var(--color-border)", borderRadius: 12, padding: 14, color: "var(--color-text-sub)", lineHeight: 1.7 }}>直接企業に接続する確認済み企業関係はありません。関係がないとは限らず、企業関係DBのcoverageにも依存します。</div>
            )}
          </div>
        </section>

        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 11, lineHeight: 1.7 }}>
          既定ではverifiedのみ表示します。テーマへの直接接続と企業間関係は別の根拠を持つ別エッジです。表示対象はcurrentな企業関係で、関連企業へのテーマ適合性は別途リサーチが必要です。
        </p>
      </section>
    </main>
  );
}
