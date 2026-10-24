import type { InvestorFlowPageData } from "./types";

export function acceptInvestorFlowUpdate(previous: InvestorFlowPageData, next: InvestorFlowPageData, start?: string, end?: string) {
  const payload = next.payload;
  const selected = next.selectedWeek;
  if (!next.manifest || !payload || !selected || next.loadFailed || next.analysisLoadFailed) throw new Error("公開データを確認できません。");
  if (payload.start_date !== selected.start_date || payload.end_date !== selected.end_date) throw new Error("表示週と本文が一致しません。");
  if (start && (payload.start_date !== start || payload.end_date !== end)) throw new Error("選択週が変更されました。");
  if (!start && previous.payload && payload.start_date < previous.payload.start_date) throw new Error("古い週へは戻しません。");
  if (previous.analysis && (!next.analysis || !next.analysisManifest)) throw new Error("分析の確認に失敗しました。");
  const analysisStamp = Date.parse(next.analysis?.generated_at_jst ?? "");
  const previousAnalysisStamp = Date.parse(previous.analysis?.generated_at_jst ?? "");
  if (previous.analysis && (!Number.isFinite(analysisStamp) || analysisStamp < previousAnalysisStamp)) throw new Error("以前の分析には戻しません。");
  const stamp = Date.parse(payload.generated_at_jst);
  const oldStamp = Date.parse(previous.payload?.generated_at_jst ?? "");
  if (!Number.isFinite(stamp) || (Number.isFinite(oldStamp) && stamp < oldStamp)) throw new Error("公開時刻が古いか不明です。");
  const advertised = next.analysisManifest?.weeks?.some(week => week.start_date === payload.start_date && week.end_date === payload.end_date) ?? false;
  if (advertised && !next.analysis) throw new Error("分析の公開完了を待っています。");
  if (next.analysis && (next.analysis.start_date !== payload.start_date || next.analysis.end_date !== payload.end_date || !Number.isFinite(analysisStamp) || analysisStamp < stamp)) throw new Error("分析の公開完了を待っています。");
  return next;
}
