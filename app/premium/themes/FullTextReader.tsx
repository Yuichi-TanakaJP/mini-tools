"use client";

import { useEffect, useRef, useState } from "react";
import { validateThemeTextChunk } from "./text-contract";
import type { ThemeTextChunk, ThemeTextSource } from "./types";
import ReadableText from "./ReadableText";
import styles from "./FullTextReader.module.css";

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

export default function FullTextReader({ themeId, sources, recordLabels = {} }: {
  themeId: string; sources?: ThemeTextSource[]; recordLabels?: Record<string, string>;
}) {
  const sectionCounts: Record<string, number> = {};
  const choices: Choice[] = (sources ?? []).flatMap((source) => {
    sectionCounts[source.section] = (sectionCounts[source.section] ?? 0) + 1;
    const name = recordLabels[`${source.section}/${source.recordId}`] ?? `記録 ${sectionCounts[source.section]}`;
    return [...source.fields].sort((a, b) => Number(b === "body") - Number(a === "body")).map((field) => ({
      section: source.section, recordId: source.recordId, field,
      label: `${sectionLabels[source.section] ?? source.section} · ${name} · ${fieldLabels[field] ?? field}`,
    }));
  });
  const [selected, setSelected] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const choice = choices[selected] ?? choices[0];
  function returnToStart() { heading.current?.focus(); }
  return <section id="full-text" aria-labelledby="full-text-heading" className={styles.panel}>
    <h2 id="full-text-heading" tabIndex={-1} ref={heading} className={styles.heading}>本文を全文で読む</h2>
    <p className={styles.description}>下の「概要」「分析履歴」は要点の表示です。ここでは選んだ項目を2,000文字ずつ受信して最後まで読めます。</p>
    {sources === undefined ? <p>全文取得APIはまだ対応していません。全文を確認できる状態ではありません。</p>
      : choices.length === 0 ? <p>全文を取得できる記録はありません。</p>
      : <>
        <label className={styles.selectLabel}>読む項目 <select aria-label="全文を読む項目" value={selected} onChange={(event) => setSelected(Number(event.target.value))} className={styles.select}>
          {choices.map((item, index) => <option key={`${item.section}/${item.recordId}/${item.field}`} value={index}>{item.label}</option>)}
        </select></label>
        <p className={styles.context}>表示対象: {choice.label}</p>
        <TextStream key={`${themeId}/${choice.section}/${choice.recordId}/${choice.field}`} themeId={themeId} choice={choice} returnToStart={returnToStart} />
      </>}
  </section>;
}

function TextStream({ themeId, choice, returnToStart }: { themeId: string; choice: Choice; returnToStart: () => void }) {
  const [chunks, setChunks] = useState<ThemeTextChunk[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const active = useRef<AbortController | null>(null);
  const loadButton = useRef<HTMLButtonElement>(null);
  const [raw, setRaw] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const last = chunks.at(-1);
  const count = last ? last.offset + Array.from(last.text).length : 0;
  const source = chunks.map((chunk) => chunk.text).join("");
  const complete = Boolean(last && !last.hasMore && !stale);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [pending]);

  async function read(restart = false) {
    if (active.current || (complete && !restart)) return;
    const previous = restart ? undefined : last;
    const offset = previous?.nextOffset ?? 0;
    const request = { themeId, section: choice.section, recordId: choice.recordId, field: choice.field, offset, revision: previous?.revision };
    const params = new URLSearchParams({ themeId, section: choice.section, recordId: choice.recordId, field: choice.field, offset: String(offset) });
    if (request.revision) params.set("revision", request.revision);
    const controller = new AbortController();
    active.current = controller;
    setPending(true); setSlow(false); setError(null);
    if (restart) { setChunks([]); setStale(false); }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 12_000);
    try {
      const response = await fetch(`/api/premium/themes/text?${params}`, { cache: "no-store", signal: controller.signal });
      if (active.current !== controller) return;
      if (timedOut) throw new Error("text deadline");
      if (controller.signal.aborted) return;
      if (response.status === 409) { setStale(true); throw new Error("本文が更新されました。最初から読み直してください。"); }
      if (!response.ok) throw new Error(response.status === 401 ? "認証の有効期限が切れました。画面を再読み込みしてください。" : "本文を取得できませんでした。同じ続きから再試行できます。");
      let chunk: ThemeTextChunk;
      try {
        const body = await response.json();
        if (active.current !== controller) return;
        if (timedOut) throw new Error("text deadline");
        if (controller.signal.aborted) return;
        chunk = validateThemeTextChunk(body, request);
      }
      catch (cause) {
        if (active.current !== controller) return;
        if (timedOut) throw cause;
        if (controller.signal.aborted) return;
        setStale(true); throw new Error("本文の続きが正しくありません。最初から読み直してください。");
      }
      if (previous && previous.totalChars !== chunk.totalChars) {
        setStale(true); throw new Error("本文の文字数が変わりました。最初から読み直してください。");
      }
      if (active.current !== controller) return;
      if (timedOut) throw new Error("text deadline");
      if (controller.signal.aborted) return;
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
    loadButton.current?.focus({ preventScroll: true });
  }
  return <div aria-busy={pending}>
    <p role="status" aria-live="polite" className={`${styles.progress} ${complete ? styles.complete : ""}`}>
      {pending ? slow ? "取得に時間がかかっています… " : "本文を取得中… " : ""}
      {last ? <><span>{count.toLocaleString()} / {last.totalChars.toLocaleString()}文字取得済み</span><span className={styles.statusWord}>{complete ? " · 全文表示済み" : "（続きあり）"}</span></> : pending ? "" : "未取得"}
    </p>
    <div role="group" aria-label="本文の表示形式" className={styles.controls}>
      <button type="button" className={styles.button} aria-pressed={!raw} onClick={() => setRaw(false)}>整形表示</button>
      <button type="button" className={styles.button} aria-pressed={raw} onClick={() => setRaw(true)}>原文表示</button>
    </div>
    <p className={styles.context}>{raw ? "受信した原文をそのまま表示しています。" : "改行記号を改行として表示し、見出し・箇条書きを整えます。原文は変更しません。"}</p>
    {chunks.length > 0 && <ReadableText source={source} raw={raw} />}
    {last?.totalChars === 0 && <p>本文は登録されていません。</p>}
    <div className={styles.end}>
      {complete ? <p className={styles.complete}>✓ 本文はここまでです（全{count.toLocaleString()}文字）</p>
        : last ? <p>残り {(last.totalChars - count).toLocaleString()}文字（目安あと{Math.ceil((last.totalChars - count) / 2000)}回）</p> : null}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.controls}>
        <button type="button" className={styles.button} ref={loadButton} aria-disabled={pending || complete} onClick={() => { if (!pending && !complete) void read(stale); }}>
          {pending ? "取得中…" : stale ? "最初から読み直す" : complete ? "全文表示済み" : error ? "同じ続きから再試行" : last ? "次の2,000文字を読む" : "全文を読み始める"}
        </button>
        {pending && <button type="button" className={styles.button} onClick={cancel}>取得を中断</button>}
        {chunks.length > 0 && <button type="button" className={styles.button} onClick={returnToStart}>本文の先頭へ</button>}
      </div>
    </div>
  </div>;
}
