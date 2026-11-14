"use client";

import { useRef, useState } from "react";
import type { StockMonitoringMetadata, StockWatchPurpose } from "./types";
import { WATCH_PURPOSE_LABELS, WATCH_PURPOSES } from "./monitoring";

export default function StockMonitoringEditor({ initial, archived, busy, onSave }: {
  initial: StockMonitoringMetadata;
  archived: boolean;
  busy: boolean;
  onSave: (value: StockMonitoringMetadata) => Promise<void>;
}) {
  const [purposes, setPurposes] = useState(initial.watchPurposes);
  const [credit, setCredit] = useState(initial.creditMonitoringEnabled);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const disabled = busy || saving;
  function toggle(purpose: StockWatchPurpose) {
    setPurposes((old) => old.includes(purpose) ? old.filter((p) => p !== purpose) : [...old, purpose]);
    setMessage(null);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || savingRef.current) return;
    savingRef.current = true; setSaving(true); setMessage(null); setFailed(false);
    try {
      await onSave({ watchPurposes: purposes, creditMonitoringEnabled: credit });
      setMessage("設定を保存しました。");
    } catch {
      setFailed(true);
      setMessage("保存を確認できませんでした。入力内容は保持しています。再取得して確認するか、同じ内容で再試行してください。");
    } finally { savingRef.current = false; setSaving(false); }
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, borderTop: "1px solid var(--color-border)", paddingTop: 12 }} aria-label="注目目的・信用残監視">
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700 }}>注目目的（複数選択可）</legend>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          {WATCH_PURPOSES.map((purpose) => (
            <label key={purpose} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <input type="checkbox" checked={purposes.includes(purpose)} onChange={() => toggle(purpose)} />
              {WATCH_PURPOSE_LABELS[purpose]}
            </label>
          ))}
        </div>
      </fieldset>
      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        信用残監視
        <select disabled={disabled} value={credit === null ? "unset" : credit ? "on" : "off"} onChange={(event) => {
          setCredit(event.target.value === "unset" ? null : event.target.value === "on"); setMessage(null);
        }} style={{ padding: 6, maxWidth: 260, color: "var(--color-text)", background: "var(--color-bg-input)" }}>
          <option value="unset">未指定（実保有のみ対象）</option>
          <option value="on">対象</option>
          <option value="off">対象外</option>
        </select>
      </label>
      <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
        信用残の取得は国内株のみです。未指定は実保有だけを対象にします。「対象」は新規調査の銘柄も含み、「対象外」は保有銘柄も除外します。
        注目目的や保有・ウォッチ等の分類とは独立した設定です。アーカイブは設定にかかわらず取得対象から除外します。
      </p>
      {archived && <p role="status" style={{ margin: 0, fontSize: 12 }}>この銘柄はアーカイブのため、信用残の取得対象外です。</p>}
      <button type="submit" disabled={disabled} style={{ justifySelf: "start", padding: "6px 12px" }}>{saving ? "保存中…" : "注目目的・監視設定を保存"}</button>
      {message && <p role={failed ? "alert" : "status"} style={{ margin: 0, fontSize: 12 }}>{message}</p>}
    </form>
  );
}
