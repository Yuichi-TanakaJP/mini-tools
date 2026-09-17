"use client";

import { useMemo, useState } from "react";
import { useYutaiRewardLedgerV2 } from "../../../lib/yutai/reward-v2-browser";
import type { RewardV2Entitlement } from "../../../lib/yutai/reward-v2-contracts";
import styles from "./YutaiEntitlementUsagePanel.module.css";

function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateTimeInput() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function titleOf(entitlement: RewardV2Entitlement) {
  return entitlement.memo.split(/\n|。/).map((part) => part.trim()).find(Boolean) ?? entitlement.benefit_kind;
}

const dynamicKinds = new Set(["discount", "service_access", "composite", "other"]);

type FormState = {
  valueYen: string;
  quantity: string;
  unit: string;
  merchant: string;
  purpose: string;
  occurredAt: string;
};

const emptyForm = (): FormState => ({ valueYen: "", quantity: "", unit: "", merchant: "", purpose: "", occurredAt: localDateTimeInput() });

export default function YutaiEntitlementUsagePanel({ onSaved }: { onSaved: () => void }) {
  const [today] = useState(localDate);
  const { state, repository } = useYutaiRewardLedgerV2(today);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(() => (state.ledger?.entitlements ?? []).filter((entitlement) =>
    entitlement.account_id === null &&
    entitlement.user_value_yen == null &&
    entitlement.face_value_yen == null &&
    dynamicKinds.has(entitlement.benefit_kind) &&
    !["cancelled", "waived"].includes(entitlement.status)
  ), [state.ledger]);

  if (state.status === "signed_out" || (targets.length === 0 && !state.uncertain && state.status !== "error")) return null;

  function formFor(id: string) {
    return forms[id] ?? emptyForm();
  }

  function patch(id: string, values: Partial<FormState>) {
    setForms((current) => ({ ...current, [id]: { ...formFor(id), ...values } }));
  }

  async function save(entitlement: RewardV2Entitlement) {
    const form = formFor(entitlement.id);
    const valueYen = Number(form.valueYen);
    if (!(valueYen > 0)) return;
    const quantity = form.quantity.trim() ? Number(form.quantity) : null;
    if (quantity != null && !(quantity > 0)) return;

    if (!repository || state.status !== "ready" || state.uncertain || saving) return;
    setSaving(entitlement.id);
    setError(null);
    try {
      const payload: Record<string, unknown> = { value_yen: valueYen };
      if (quantity != null) payload.native_quantity = quantity;
      if (form.unit.trim()) payload.native_unit = form.unit.trim();
      if (form.merchant.trim()) payload.merchant_name = form.merchant.trim();
      if (form.purpose.trim()) payload.purpose = form.purpose.trim();
      const occurredAt = new Date(form.occurredAt || localDateTimeInput()).toISOString();
      const result = await repository.save({
        command_type: "record_entitlement_usage",
        target: { id: entitlement.id },
        payload,
        expected_revision: entitlement.revision,
        note: "MiniTools: 固定額でない優待の利用実績を記録",
      }, undefined, occurredAt);
      if (result) {
        setForms((current) => ({ ...current, [entitlement.id]: emptyForm() }));
        onSaved();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(null);
    }
  }

  async function retryUncertain() {
    if (!repository || saving || !state.uncertain) return;
    setSaving("retry");
    setError(null);
    try {
      const result = await repository.retryUncertain();
      if (result && state.uncertain.command_type === "record_entitlement_usage") {
        const id = state.uncertain.target.id;
        if (typeof id === "string") setForms((current) => ({ ...current, [id]: emptyForm() }));
        onSaved();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(null);
    }
  }

  return (
    <details className={styles.panel}>
      <summary>利用実績を記録</summary>
      <div className={styles.body}>
        <p>固定額がない割引・サービス優待は、実際に得した金額を円換算して記録します。履歴には利用回数・人数など元の単位も残せます。</p>
        {(error || state.error) && <div className={styles.error} role="alert">{error || state.error}</div>}
        {state.uncertain && <div className={styles.error} role="alert">保存結果を確認できません。重複を避けるため、同じ要求IDで再確認してください。<button type="button" disabled={Boolean(saving)} onClick={() => void retryUncertain()}>同じ要求で再確認</button></div>}
        {state.status === "error" && !state.uncertain && <button type="button" onClick={() => void repository?.load(today)}>最新台帳を再取得</button>}
        {targets.map((entitlement) => {
          const form = formFor(entitlement.id);
          return (
            <section className={styles.card} key={entitlement.id}>
              <div className={styles.heading}>
                <strong>{titleOf(entitlement)}</strong>
                <span>{entitlement.benefit_kind}</span>
              </div>
              <div className={styles.grid}>
                <label>円換算価値<input type="number" min="1" step="1" value={form.valueYen} onChange={(event) => patch(entitlement.id, { valueYen: event.target.value })} placeholder="例: 2000" /></label>
                <label>数量・人数<input type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => patch(entitlement.id, { quantity: event.target.value })} placeholder="例: 2" /></label>
                <label>単位<input value={form.unit} onChange={(event) => patch(entitlement.id, { unit: event.target.value })} placeholder="人 / 回 / 枚" /></label>
                <label>利用先<input value={form.merchant} onChange={(event) => patch(entitlement.id, { merchant: event.target.value })} placeholder="例: 伊勢丹新宿店" /></label>
                <label className={styles.wide}>用途<input value={form.purpose} onChange={(event) => patch(entitlement.id, { purpose: event.target.value })} placeholder="例: 10%割引 / 無料入館" /></label>
                <label className={styles.wide}>利用日時<input type="datetime-local" value={form.occurredAt} onChange={(event) => patch(entitlement.id, { occurredAt: event.target.value })} /></label>
              </div>
              <button type="button" disabled={state.status !== "ready" || Boolean(state.uncertain) || Boolean(saving) || !form.valueYen} onClick={() => void save(entitlement)}>{saving === entitlement.id ? "保存中…" : "利用実績を保存"}</button>
            </section>
          );
        })}
      </div>
    </details>
  );
}
