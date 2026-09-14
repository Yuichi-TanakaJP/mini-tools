"use client";

import { useEffect, useMemo, useState } from "react";
import { RewardLedgerV2Panel } from "./RewardLedgerV2Panel";
import { useYutaiRewardLedgerV2 } from "../../../lib/yutai/reward-v2-browser";
import type {
  RewardV2Coverage,
  RewardV2EntitlementStatus,
  RewardV2LegacyReward,
} from "../../../lib/yutai/reward-v2-contracts";
import styles from "./RewardLedgerV2Panel.module.css";

function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function valueText(value: number, reward: RewardV2LegacyReward) {
  const formatted = value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
  if (reward.track_mode === "amount") return `¥${formatted}`;
  if (reward.unit_yen != null) return `${formatted}枚 × ¥${reward.unit_yen.toLocaleString("ja-JP")}`;
  return `${formatted} count`;
}

function coverageLabel(value: RewardV2Coverage) {
  if (value === "native_complete") return "追跡完全";
  if (value === "legacy_opening_balance") return "移行時残高";
  if (value === "history_partial") return "履歴一部";
  return "履歴不明";
}

const statusOptions: Array<{ value: Exclude<RewardV2EntitlementStatus, "unknown">; label: string }> = [
  { value: "eligible", label: "権利あり" },
  { value: "claim_required", label: "申込必要" },
  { value: "claimed", label: "申込済み" },
  { value: "activated", label: "有効化済み" },
  { value: "fulfilled", label: "受取/完了" },
  { value: "expired", label: "失効" },
  { value: "waived", label: "利用しない" },
  { value: "cancelled", label: "取消" },
];

export function RewardLedgerV2Workspace() {
  const [today, setToday] = useState(localDate);
  const { state, repository } = useYutaiRewardLedgerV2(today);
  const [accountTargets, setAccountTargets] = useState<Record<string, string>>({});
  const [entitlementTargets, setEntitlementTargets] = useState<Record<string, string>>({});
  const [statusTargets, setStatusTargets] = useState<Record<string, Exclude<RewardV2EntitlementStatus, "unknown">>>({});
  const ledger = state.ledger;
  const busy = state.status !== "ready" || Boolean(state.uncertain);

  useEffect(() => {
    const update = () => setToday(localDate());
    const timer = setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);

  const actionable = useMemo(
    () => ledger?.unassigned_rewards.filter((r) => !r.archived_at && r.remaining_value > 0) ?? [],
    [ledger]
  );
  const historical = useMemo(
    () => ledger?.unassigned_rewards.filter((r) => Boolean(r.archived_at) || r.remaining_value === 0) ?? [],
    [ledger]
  );
  const standaloneEntitlements = useMemo(
    () => ledger?.entitlements.filter((e) => e.account_id === null) ?? [],
    [ledger]
  );
  const unknownEntitlements = useMemo(
    () => ledger?.entitlements.filter((e) => e.status === "unknown") ?? [],
    [ledger]
  );

  async function linkAccount(reward: RewardV2LegacyReward) {
    if (!repository) return;
    const accountId = accountTargets[reward.id];
    if (!accountId) return;
    await repository.save({
      command_type: "link_legacy_reward",
      target: { id: reward.id },
      payload: { account_id: accountId, coverage_state: reward.coverage_state },
      expected_revision: reward.revision,
      note: "MiniTools: 要整理legacy RewardをAccountへ非破壊紐付け",
    });
  }

  async function linkEntitlement(reward: RewardV2LegacyReward) {
    if (!repository) return;
    const entitlementId = entitlementTargets[reward.id];
    if (!entitlementId) return;
    await repository.save({
      command_type: "link_legacy_entitlement",
      target: { id: reward.id },
      payload: { entitlement_id: entitlementId },
      expected_revision: reward.revision,
      note: "MiniTools: 要整理legacy RewardをAccountなしEntitlementへ非破壊紐付け",
    });
  }

  async function resolveUnknown(entitlementId: string, revision: number) {
    if (!repository) return;
    const status = statusTargets[entitlementId];
    if (!status) return;
    await repository.save({
      command_type: "set_entitlement_status",
      target: { id: entitlementId },
      payload: { status },
      expected_revision: revision,
      note: `MiniTools: 根拠確認後にunknown Entitlementを${status}へ明示確定`,
    });
  }

  const hideLegacyStyle = ledger && ledger.unassigned_rewards.length > 0
    ? `[data-yutai-v2-workspace] > section.${styles.panel}:first-of-type > .${styles.section}:last-child{display:none}`
    : "";

  return (
    <div data-yutai-v2-workspace>
      {hideLegacyStyle && <style>{hideLegacyStyle}</style>}
      <RewardLedgerV2Panel />

      {ledger && (ledger.unassigned_rewards.length > 0 || unknownEntitlements.length > 0) && (
        <section className={styles.panel} aria-labelledby="reward-v2-migration-title">
          <div className={styles.header}>
            <div>
              <h3 id="reward-v2-migration-title">移行・確認キュー</h3>
              <p>推測変換が必要な旧データと、すでに完了した過去履歴を分離します。</p>
            </div>
            <div className={styles.badges}>
              <span className={styles.badge}>要整理 {actionable.length}</span>
              <span className={styles.badge}>過去履歴 {historical.length}</span>
              <span className={styles.badge}>状態未確定 {unknownEntitlements.length}</span>
            </div>
          </div>

          {actionable.length > 0 && (
            <div className={styles.section}>
              <h4>要整理</h4>
              <p className={styles.muted}>残高が残る未割当データです。単位や期限anchorの根拠がない場合は無理に紐付けません。</p>
              <div className={styles.legacyList}>
                {actionable.map((reward) => (
                  <div className={styles.card} key={reward.id}>
                    <strong>{reward.title}</strong> <span className={styles.muted}>{reward.company}</span>
                    <div className={styles.muted}>
                      現在 {valueText(reward.remaining_value, reward)} / 期限 {reward.expires_on ?? "なし"} / {coverageLabel(reward.coverage_state)}
                    </div>
                    {reward.title === "U-NEXTポイント" && <div className={styles.warning}>旧count形式をpointへ推測換算しません。今後の付与はU-NEXT point Accountへ登録します。</div>}
                    {reward.title === "マジカポイント" && <div className={styles.warning}>最後の付与日を旧期限から逆算しません。今後の付与はmajica Accountで追跡します。</div>}
                    {ledger.accounts.length > 0 && (
                      <div className={styles.inline}>
                        <label>Account
                          <select value={accountTargets[reward.id] ?? ""} onChange={(e) => setAccountTargets((v) => ({ ...v, [reward.id]: e.target.value }))}>
                            <option value="">選択</option>
                            {ledger.accounts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                          </select>
                        </label>
                        <button type="button" disabled={busy || !accountTargets[reward.id]} onClick={() => void linkAccount(reward)}>Accountへ紐付け</button>
                      </div>
                    )}
                    {standaloneEntitlements.length > 0 && (
                      <div className={styles.inline}>
                        <label>Accountなし権利
                          <select value={entitlementTargets[reward.id] ?? ""} onChange={(e) => setEntitlementTargets((v) => ({ ...v, [reward.id]: e.target.value }))}>
                            <option value="">選択</option>
                            {standaloneEntitlements.map((e) => <option key={e.id} value={e.id}>{e.benefit_kind} / {e.status}{e.memo ? ` / ${e.memo.slice(0, 28)}` : ""}</option>)}
                          </select>
                        </label>
                        <button type="button" disabled={busy || !entitlementTargets[reward.id]} onClick={() => void linkEntitlement(reward)}>権利へ紐付け</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {unknownEntitlements.length > 0 && (
            <div className={styles.section}>
              <h4>状態未確定の権利</h4>
              <p className={styles.muted}>権利の存在は確認済みですが、申込・有効化等を旧履歴から証明できないものです。根拠を確認した後だけ状態を確定します。</p>
              <div className={styles.legacyList}>
                {unknownEntitlements.map((entitlement) => (
                  <div className={styles.card} key={entitlement.id}>
                    <strong>{entitlement.benefit_kind}</strong>
                    <div className={styles.muted}>{entitlement.memo || "memoなし"}</div>
                    <div className={styles.muted}>期限: {entitlement.deadlines.map((d) => `${d.deadline_type} ${d.due_on}`).join(" / ") || "なし"}</div>
                    <div className={styles.inline}>
                      <label>確認した状態
                        <select value={statusTargets[entitlement.id] ?? ""} onChange={(e) => setStatusTargets((v) => ({ ...v, [entitlement.id]: e.target.value as Exclude<RewardV2EntitlementStatus, "unknown"> }))}>
                          <option value="">選択</option>
                          {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </label>
                      <button type="button" disabled={busy || !statusTargets[entitlement.id]} onClick={() => void resolveUnknown(entitlement.id, entitlement.revision)}>状態を確定</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historical.length > 0 && (
            <details className={styles.section}>
              <summary>過去履歴 {historical.length}件</summary>
              <p className={styles.muted}>使用済み・残高0・アーカイブ済みの旧データです。通常の移行作業対象ではありません。</p>
              <div className={styles.legacyList}>
                {historical.map((reward) => (
                  <div className={styles.card} key={reward.id}>
                    <strong>{reward.title}</strong> <span className={styles.muted}>{reward.company}</span>
                    <div className={styles.muted}>残 {valueText(reward.remaining_value, reward)} / 期限 {reward.expires_on ?? "なし"} / {reward.archived_at ? "アーカイブ済み" : "残高0"}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
