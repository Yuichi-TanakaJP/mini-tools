import Link from "next/link";
import type { CompanyGroupExposure } from "./company-group-exposure";

function formatYen(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(date);
}

export default function CompanyGroupExposureCard({ exposure, asOf }: { exposure: CompanyGroupExposure; asOf: string | null }) {
  const hasGroups = exposure.groups.length > 0;

  return (
    <section style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 800 }}>企業関係ネットワーク × ポートフォリオ</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>企業グループ集中（事実ベース）</h2>
          <p style={{ margin: "8px 0 0", color: "var(--color-text-sub)", fontSize: 13, lineHeight: 1.7 }}>
            最新の公式保有を、確認済みの企業グループ所属で横断します。同じグループへの所属は表示しますが、業績連動や受益関係までは推論しません。
          </p>
        </div>
        <Link href="/premium/company-network" style={{ color: "var(--color-accent)", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
          企業関係マップを開く →
        </Link>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 13 }}>
          <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontWeight: 800 }}>グループ所属を確認できた評価額</div>
          <div style={{ marginTop: 6, fontSize: 21, fontWeight: 900 }}>{formatYen(exposure.groupResolvedMarketValue)}</div>
          <div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 11 }}>公式保有全体の {formatPct(exposure.coveragePct)}</div>
        </div>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 13 }}>
          <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontWeight: 800 }}>グループ所属まで解決</div>
          <div style={{ marginTop: 6, fontSize: 21, fontWeight: 900 }}>{exposure.groupResolvedInstrumentCount} / {exposure.eligibleInstrumentCount} 銘柄</div>
          <div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 11 }}>対象: stock_id付き国内株</div>
        </div>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 13 }}>
          <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontWeight: 800 }}>company identityまで解決</div>
          <div style={{ marginTop: 6, fontSize: 21, fontWeight: 900 }}>{exposure.companyResolvedInstrumentCount} / {exposure.eligibleInstrumentCount} 銘柄</div>
          <div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 11 }}>未解決を「所属なし」とみなしません</div>
        </div>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 13 }}>
          <div style={{ color: "var(--color-text-muted)", fontSize: 11, fontWeight: 800 }}>基準日</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>{formatDate(asOf)}</div>
          <div style={{ marginTop: 4, color: "var(--color-text-muted)", fontSize: 11 }}>最新ready公式snapshot</div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {hasGroups ? exposure.groups.map((group) => (
          <article key={group.groupId} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <div>
                <strong style={{ fontSize: 16 }}>{group.groupName}</strong>
                <span style={{ marginLeft: 8, color: "var(--color-text-muted)", fontSize: 11 }}>{group.groupType}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>{formatYen(group.marketValue)}</strong>
                <span style={{ marginLeft: 8, color: "var(--color-text-sub)", fontSize: 12 }}>公式保有の {formatPct(group.portfolioSharePct)}</span>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
              {group.members.map((member) => (
                <div key={`${group.groupId}:${member.instrumentId}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--color-border)", paddingTop: 7 }}>
                  <span><strong>{member.identifier}</strong> {member.name}</span>
                  <span style={{ color: "var(--color-text-sub)", fontSize: 12 }}>
                    {formatYen(member.marketValue)} / 根拠 {member.membershipBasis} / source {formatDate(member.sourceAsOf)}
                  </span>
                </div>
              ))}
            </div>
          </article>
        )) : (
          <div style={{ border: "1px dashed var(--color-border)", borderRadius: 10, padding: 14, color: "var(--color-text-sub)", fontSize: 13, lineHeight: 1.7 }}>
            現在の確認済みデータでは、最新保有に結び付く企業グループ所属を表示できません。これは「企業グループへの集中がない」という意味ではなく、company identity / group membership のデータ整備が未完了である可能性を含みます。
          </div>
        )}
      </div>

      <p style={{ margin: "14px 0 0", color: "var(--color-text-muted)", fontSize: 11, lineHeight: 1.7 }}>
        集計対象は current・verified の corporate_group / capital_group / keiretsu / presidents_club です。旧財閥などの歴史的系譜は現代の資本集中と同一視しないため除外しています。複数グループに正式所属する企業は各グループへ表示されるため、グループ別金額の単純合計はポートフォリオ評価額と一致しない場合があります。
      </p>
    </section>
  );
}
