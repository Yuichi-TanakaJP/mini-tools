import { confirmedMarketDate, parseMarketObservation } from "@/lib/market-observation";

export function MarketObservationNotice({ observation, savedDate, generatedAt }: { observation: unknown; savedDate: string; generatedAt?: string }) {
  const parsed = parseMarketObservation(observation);
  const marketDate = confirmedMarketDate(parsed);
  return <section aria-label="表示データの日付" style={{ padding: 14, marginBottom: 16, border: "1px solid var(--color-border)", borderRadius: 12, overflowWrap: "anywhere", lineHeight: 1.8 }}>
    <strong>{marketDate ? "相場日確認済み" : "相場日未確認（UNKNOWN）"}</strong>
    <div>相場日：{marketDate ?? "取得元から未提供"}</div>
    <div>保存日：{savedDate}（日付選択の基準）</div>
    <div>取得時刻：{parsed?.collected_at ?? "未記録（旧データ）"}</div>
    <div>JSON生成時刻：{parsed?.generated_at ?? (generatedAt && Number.isFinite(Date.parse(generatedAt)) ? generatedAt : "未提供")}</div>
    <p style={{ margin: "4px 0 0" }}>取得元の相場日を受け取れたデータは自動で反映します。再取得や確認操作は不要です。保存日・取得時刻を相場日として扱いません。</p>
  </section>;
}
