"use client";

import { useEffect, useRef, useState } from "react";
import { validateThemeTextChunk } from "./text-contract";
import type { ThemeTextChunk, ThemeTextSource } from "./types";

const sectionLabels: Record<string, string> = {
  analysisHistory: "分析履歴", thesisHistory: "仮説履歴", evidence: "根拠", openActions: "確認事項",
  directLinks: "直接リンク", "taxonomyMap.nodes": "分類ノード", "taxonomyMap.edges": "分類関係",
  "taxonomyMap.themeLinks": "テーマ分類", "taxonomyMap.stockLinks": "銘柄分類",
  "metrics.definitions": "指標定義", "metrics.snapshots": "指標基準日", "metrics.values": "指標値",
};
const fieldLabels: Record<string, string> = {
  body: "記録本文", conclusion: "結論", evidence: "根拠メモ", concerns: "懸念", definition: "定義",
  structuralHypothesis: "構造仮説", lenses: "観点", risks: "リスク", falsificationConditions: "反証条件",
  nextChecks: "次の確認", claim: "主張", sourceTitle: "出典タイトル", detail: "詳細",
  triggerCondition: "実行条件", outcomeNote: "結果メモ", relationNote: "関係メモ",
  verificationNote: "確認メモ", description: "説明", note: "メモ", calculationNote: "計算メモ",
};
type Choice = { section: string; recordId: string; field: string; label: string };

export default function FullTextReader({ themeId, sources }: { themeId: string; sources?: ThemeTextSource[] }) {
  const choices: Choice[] = (sources ?? []).flatMap((source, index) =>
    [...source.fields].sort((a, b) => Number(b === "body") - Number(a === "body")).map((field) => ({
      section: source.section, recordId: source.recordId, field,
      label: `${sectionLabels[source.section] ?? source.section} ${index + 1} · ${fieldLabels[field] ?? field} · ${source.recordId.slice(0, 8)}`,
    })));
  const [selected, setSelected] = useState(0);
  return <section id="full-text" aria-labelledby="full-text-heading" style={{ padding: 18, border: "1px solid var(--color-border)", borderRadius: 18, background: "var(--color-bg-card)", marginBottom: 20 }}>
    <h2 id="full-text-heading">本文を全文で読む</h2>
    <p>概要・履歴の短縮表示とは別に、選んだ項目を2,000文字ずつ受信します。取得済みの本文はそのまま残ります。</p>
    {sources === undefined ? <p>全文取得APIはまだ対応していません。全文を確認できる状態ではありません。</p>
      : choices.length === 0 ? <p>全文を取得できる記録はありません。</p>
      : <>
        <label>読む項目 <select aria-label="全文を読む項目" value={selected} onChange={(event) => setSelected(Number(event.target.value))} style={{ maxWidth: "100%" }}>
          {choices.map((choice, index) => <option key={`${choice.section}/${choice.recordId}/${choice.field}`} value={index}>{choice.label}</option>)}
        </select></label>
        <TextStream key={`${themeId}/${choices[selected].section}/${choices[selected].recordId}/${choices[selected].field}`} themeId={themeId} choice={choices[selected]} />
      </>}
  </section>;
}

function TextStream({ themeId, choice }: { themeId: string; choice: Choice }) {
  const [chunks, setChunks] = useState<ThemeTextChunk[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const last = chunks.at(-1);
  const count = last ? last.offset + Array.from(last.text).length : 0;

  async function read(restart = false) {
    if (active.current) return;
    const previous = restart ? undefined : last;
    const offset = previous?.nextOffset ?? 0;
    const request = { themeId, section: choice.section, recordId: choice.recordId, field: choice.field, offset, revision: previous?.revision };
    const params = new URLSearchParams({ themeId, section: choice.section, recordId: choice.recordId, field: choice.field, offset: String(offset) });
    if (request.revision) params.set("revision", request.revision);
    const controller = new AbortController();
    active.current = controller;
    setPending(true); setError(null);
    if (restart) { setChunks([]); setStale(false); }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 12_000);
    try {
      const response = await fetch(`/api/premium/themes/text?${params}`, { cache: "no-store", signal: controller.signal });
      if (response.status === 409) { setStale(true); throw new Error("本文が更新されました。最初から読み直してください。"); }
      if (!response.ok) throw new Error(response.status === 401 ? "認証の有効期限が切れました。画面を再読み込みしてください。" : "本文を取得できませんでした。同じ続きから再試行できます。");
      let chunk: ThemeTextChunk;
      try { chunk = validateThemeTextChunk(await response.json(), request); }
      catch { setStale(true); throw new Error("本文の続きが正しくありません。最初から読み直してください。"); }
      if (previous && previous.totalChars !== chunk.totalChars) {
        setStale(true); throw new Error("本文の文字数が変わりました。最初から読み直してください。");
      }
      if (active.current !== controller || controller.signal.aborted) return;
      setChunks((current) => restart ? [chunk] : [...current, chunk]);
    } catch (cause) {
      if (active.current === controller) setError(timedOut ? "取得が時間内に完了しませんでした。同じ続きから再試行できます。" : cause instanceof Error ? cause.message : "取得に失敗しました。");
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { active.current = null; setPending(false); }
    }
  }
  function cancel() {
    active.current?.abort(); active.current = null; setPending(false);
    setError("取得を中断しました。同じ続きから再試行できます。");
  }
  return <div aria-busy={pending}>
    <p role="status" aria-live="polite">{pending ? "本文を取得中… " : ""}{last ? `${count.toLocaleString()} / ${last.totalChars.toLocaleString()}文字取得済み${last.hasMore ? "（続きあり）" : " · 全文表示済み"}` : "未取得"}</p>
    {chunks.length > 0 && <div data-testid="full-text-content" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.85 }}>{chunks.map((chunk) => <span key={chunk.offset}>{chunk.text}</span>)}{last?.totalChars === 0 && "登録なし"}</div>}
    {error && <p role="alert">{error}</p>}
    {pending ? <button type="button" onClick={cancel}>取得を中断</button>
      : stale ? <button type="button" onClick={() => void read(true)}>最初から読み直す</button>
      : !last || last.hasMore ? <button type="button" onClick={() => void read()}>{error ? "同じ続きから再試行" : last ? "次の2,000文字を読む" : "全文を読み始める"}</button> : null}
  </div>;
}
