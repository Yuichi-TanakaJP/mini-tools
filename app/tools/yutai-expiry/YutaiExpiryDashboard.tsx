"use client";

import { useEffect, useMemo, useState } from "react";
import { useYutaiRewardLedgerV2 } from "../../../lib/yutai/reward-v2-browser";
import type {
  RewardV2Account,
  RewardV2BenefitKind,
  RewardV2DeadlineType,
  RewardV2Entitlement,
  RewardV2EntitlementStatus,
  RewardV2LegacyReward,
} from "../../../lib/yutai/reward-v2-contracts";
import { RewardLedgerV2Panel } from "./RewardLedgerV2Panel";
import DatabaseRewardsGate from "./DatabaseRewardsGate";
import styles from "./YutaiExpiryDashboard.module.css";

function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function numberText(value: number) {
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function shortDate(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}/${day}`;
}

function dateLabel(value: string, today: string) {
  const [year, month, day] = value.split("-").map(Number);
  const currentYear = Number(today.slice(0, 4));
  return year === currentYear ? `${month}月${day}日` : `${year}年${month}月${day}日`;
}

function accountValueText(account: RewardV2Account, value = account.available_balance_native) {
  const n = numberText(value);
  if (account.native_unit === "yen") return `¥${n}`;
  if (["point", "points", "pt"].includes(account.native_unit)) return `${n} pt`;
  if (account.benefit_kind === "voucher" || account.benefit_kind === "admission") return `${n}枚`;
  if (account.native_unit === "month") return `${n}か月`;
  if (account.native_unit === "membership") return `${n}口`;
  if (["count", "unit"].includes(account.native_unit)) return `${n}個`;
  return `${n} ${account.native_unit}`;
}

function legacyValueText(reward: RewardV2LegacyReward) {
  const n = numberText(reward.remaining_value);
  if (reward.title.includes("ポイント")) return `${n} pt（旧形式）`;
  if (reward.track_mode === "amount") return `¥${n}`;
  if (reward.unit_yen != null) return `${n}枚（1枚 ¥${numberText(reward.unit_yen)}）`;
  return `${n}個（旧形式）`;
}

const benefitLabels: Record<RewardV2BenefitKind, string> = {
  stored_value: "電子マネー・金額残高",
  points: "ポイント",
  voucher: "優待券",
  admission: "入場・招待",
  discount: "割引優待",
  service_access: "サービス利用権",
  service_period: "サービス利用期間",
  choice: "選択型優待",
  goods: "商品優待",
  cashback: "還元",
  composite: "複合優待",
  other: "その他の優待",
};

const statusLabels: Record<RewardV2EntitlementStatus, string> = {
  unknown: "状態未確認",
  eligible: "権利あり",
  claim_required: "申込が必要",
  claimed: "申込済み",
  activated: "利用開始済み",
  fulfilled: "受取・完了",
  expired: "失効",
  waived: "利用しない",
  cancelled: "取消",
};

const deadlineLabels: Record<RewardV2DeadlineType, string> = {
  claim_by: "申込期限",
  activate_by: "利用開始期限",
  book_by: "予約期限",
  usable_from: "利用開始日",
  use_by: "利用期限",
  service_starts_at: "サービス開始",
  service_ends_at: "サービス終了",
};

const statusOptions: Array<{ value: Exclude<RewardV2EntitlementStatus, "unknown">; label: string }> = [
  { value: "eligible", label: "権利あり" },
  { value: "claim_required", label: "申込が必要" },
  { value: "claimed", label: "申込済み" },
  { value: "activated", label: "利用開始済み" },
  { value: "fulfilled", label: "受取・完了" },
  { value: "expired", label: "失効" },
  { value: "waived", label: "利用しない" },
  { value: "cancelled", label: "取消" },
];

function entitlementTitle(entitlement: RewardV2Entitlement) {
  const firstLine = entitlement.memo.split(/\n|。/).map((part) => part.trim()).find(Boolean);
  if (firstLine) return firstLine.length > 42 ? `${firstLine.slice(0, 42)}…` : firstLine;
  return benefitLabels[entitlement.benefit_kind];
}

function deadlineSatisfied(entitlement: RewardV2Entitlement, type: RewardV2DeadlineType) {
  if (entitlement.status === "fulfilled") return true;
  if (type === "claim_by" && ["claimed", "activated", "fulfilled"].includes(entitlement.status)) return true;
  if (type === "activate_by" && ["activated", "fulfilled"].includes(entitlement.status)) return true;
  if (type === "use_by" && entitlement.status === "fulfilled") return true;
  return false;
}

function isActionDeadline(type: RewardV2DeadlineType) {
  return ["claim_by", "activate_by", "book_by", "use_by", "service_ends_at"].includes(type);
}

type DeadlineItem = {
  id: string;
  date: string;
  title: string;
  value: string;
  meta: string;
  source: "残高" | "手続き" | "期限切れ";
  overdue: boolean;
};

type DeadlineGroup = { date: string; items: DeadlineItem[] };

export default function YutaiExpiryDashboard({ scanEnabled = false }: { scanEnabled?: boolean }) {
  const [today, setToday] = useState(localDate);
  const [query, setQuery] = useState("");
  const [statusTargets, setStatusTargets] = useState<Record<string, Exclude<RewardV2EntitlementStatus, "unknown">>>({});
  const { state, repository } = useYutaiRewardLedgerV2(today);
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

  const activeAccounts = useMemo(
    () => (ledger?.accounts ?? []).filter((account) => account.status === "active" && account.recorded_balance_native > 0),
    [ledger]
  );

  const unknownEntitlements = useMemo(
    () => (ledger?.entitlements ?? []).filter((entitlement) => entitlement.status === "unknown"),
    [ledger]
  );

  const actionableLegacy = useMemo(
    () => (ledger?.unassigned_rewards ?? []).filter((reward) => !reward.archived_at && reward.remaining_value > 0),
    [ledger]
  );

  const deadlineItems = useMemo(() => {
    const items: DeadlineItem[] = [];

    for (const account of activeAccounts) {
      if (account.expired_unprocessed_native > 0) {
        const expiredLotDates = account.lots
          .filter((lot) => !lot.archived_at && lot.remaining_value > 0 && lot.expires_on && lot.expires_on < today)
          .map((lot) => lot.expires_on as string)
          .sort();
        const expiredDate = account.rolling_expires_on && account.rolling_expires_on < today
          ? account.rolling_expires_on
          : expiredLotDates[0] ?? today;
        items.push({
          id: `expired:${account.id}`,
          date: expiredDate,
          title: account.title,
          value: accountValueText(account, account.expired_unprocessed_native),
          meta: "期限を過ぎた残高があります。高度な編集から失効確定または内容確認を行います。",
          source: "期限切れ",
          overdue: true,
        });
      }

      if (account.available_balance_native > 0 && account.nearest_expiry) {
        items.push({
          id: `account:${account.id}`,
          date: account.nearest_expiry,
          title: account.title,
          value: accountValueText(account),
          meta: benefitLabels[account.benefit_kind],
          source: "残高",
          overdue: account.nearest_expiry < today,
        });
      }
    }

    for (const entitlement of ledger?.entitlements ?? []) {
      if (["fulfilled", "expired", "waived", "cancelled"].includes(entitlement.status)) continue;
      for (const deadline of entitlement.deadlines) {
        if (deadline.completed_at || !isActionDeadline(deadline.deadline_type) || deadlineSatisfied(entitlement, deadline.deadline_type)) continue;
        items.push({
          id: `deadline:${deadline.id}`,
          date: deadline.due_on,
          title: entitlementTitle(entitlement),
          value: deadlineLabels[deadline.deadline_type],
          meta: `${benefitLabels[entitlement.benefit_kind]}・${statusLabels[entitlement.status]}`,
          source: "手続き",
          overdue: deadline.due_on < today,
        });
      }
    }

    return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ja"));
  }, [activeAccounts, ledger, today]);

  const noExpiryAccounts = useMemo(
    () => activeAccounts
      .filter((account) => account.available_balance_native > 0 && !account.nearest_expiry)
      .sort((a, b) => a.title.localeCompare(b.title, "ja")),
    [activeAccounts]
  );

  const filteredDeadlineItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja");
    if (!needle) return deadlineItems;
    return deadlineItems.filter((item) => `${item.title} ${item.value} ${item.meta}`.toLocaleLowerCase("ja").includes(needle));
  }, [deadlineItems, query]);

  const groups = useMemo(() => {
    const byDate = new Map<string, DeadlineItem[]>();
    for (const item of filteredDeadlineItems) {
      const list = byDate.get(item.date) ?? [];
      list.push(item);
      byDate.set(item.date, list);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({ date, items } satisfies DeadlineGroup));
  }, [filteredDeadlineItems]);

  const overdueCount = deadlineItems.filter((item) => item.overdue).length;
  const thisMonthPrefix = today.slice(0, 7);
  const thisMonthCount = deadlineItems.filter((item) => !item.overdue && item.date.startsWith(thisMonthPrefix)).length;
  const nextDate = deadlineItems.find((item) => item.date >= today)?.date ?? null;
  const nextCount = nextDate ? deadlineItems.filter((item) => item.date === nextDate).length : 0;
  const reviewCount = actionableLegacy.length + unknownEntitlements.length;

  const firstGroups = groups.filter((group) => group.date < today);
  const futureGroups = groups.filter((group) => group.date >= today);
  const primaryGroups = [...firstGroups, ...futureGroups.slice(0, 3)];
  const laterGroups = futureGroups.slice(3);

  async function resolveUnknown(entitlement: RewardV2Entitlement) {
    if (!repository) return;
    const status = statusTargets[entitlement.id];
    if (!status) return;
    await repository.save({
      command_type: "set_entitlement_status",
      target: { id: entitlement.id },
      payload: { status },
      expected_revision: entitlement.revision,
      note: `MiniTools: 状態未確認の優待を根拠確認後に${status}へ明示確定`,
    });
  }

  if (state.status === "signed_out" || !state.ownerId) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <h1>株主優待期限帳</h1>
          <p>優待データを見るにはログインが必要です。</p>
          <a className={styles.primaryLink} href="/account">ログイン画面へ</a>
        </section>
      </main>
    );
  }

  if (!ledger) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <h1>株主優待期限帳</h1>
          <p>{state.error ? `優待データを取得できませんでした: ${state.error}` : "優待データを読み込んでいます…"}</p>
          {state.error && <button type="button" onClick={() => window.location.reload()}>再読み込み</button>}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>株主優待期限帳</p>
          <h1>次に使う優待が、すぐ分かる。</h1>
          <p className={styles.heroCopy}>期限が近い順にまとめています。普段はここだけ見れば大丈夫です。</p>
        </div>

        {overdueCount > 0 && (
          <div className={styles.alert} role="alert">
            <strong>期限を過ぎた確認項目が {overdueCount}件あります。</strong>
            <span>下の期限グループと「要確認」を確認してください。</span>
          </div>
        )}

        <div className={styles.summaryGrid} aria-label="期限サマリー">
          <div className={styles.summaryCard}>
            <small>今月期限</small>
            <strong>{thisMonthCount === 0 ? "なし" : `${thisMonthCount}件`}</strong>
            <span>{thisMonthCount === 0 ? "今月は急ぎなし" : "今月中に対応"}</span>
          </div>
          <div className={styles.summaryCard}>
            <small>次の期限</small>
            <strong>{nextDate ? shortDate(nextDate) : "なし"}</strong>
            <span>{nextDate ? `${nextCount}件` : "期限登録なし"}</span>
          </div>
          <a className={`${styles.summaryCard} ${styles.summaryLink}`} href="#yutai-review">
            <small>要確認</small>
            <strong>{reviewCount}件</strong>
            <span>{reviewCount ? "状態・旧データ" : "確認事項なし"}</span>
          </a>
        </div>
      </section>

      <details className={styles.toolbox}>
        <summary>検索・絞り込み</summary>
        <div className={styles.toolboxBody}>
          <label>
            優待名で検索
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例: U-NEXT / コメダ" />
          </label>
          {query && <button type="button" onClick={() => setQuery("")}>検索をクリア</button>}
        </div>
      </details>

      <section className={styles.deadlines} aria-labelledby="deadline-list-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="deadline-list-title">期限がある優待</h2>
            <p>同じ期限のものをまとめています。</p>
          </div>
          <span>{filteredDeadlineItems.length}件</span>
        </div>

        {primaryGroups.length === 0 && <div className={styles.empty}>条件に一致する期限付き優待はありません。</div>}
        {primaryGroups.map((group) => <DeadlineGroupView key={group.date} group={group} today={today} />)}

        {laterGroups.length > 0 && (
          <details className={styles.later}>
            <summary>その先の期限を見る（{laterGroups.reduce((sum, group) => sum + group.items.length, 0)}件）</summary>
            <div className={styles.laterBody}>
              {laterGroups.map((group) => <DeadlineGroupView key={group.date} group={group} today={today} />)}
            </div>
          </details>
        )}
      </section>

      {noExpiryAccounts.length > 0 && (
        <details className={styles.secondarySection}>
          <summary>期限なし・期限未設定の残高（{noExpiryAccounts.length}件）</summary>
          <div className={styles.simpleList}>
            {noExpiryAccounts.map((account) => (
              <div className={styles.simpleRow} key={account.id}>
                <div>
                  <strong>{account.title}</strong>
                  <span>{benefitLabels[account.benefit_kind]}</span>
                </div>
                <b>{accountValueText(account)}</b>
              </div>
            ))}
          </div>
        </details>
      )}

      {reviewCount > 0 && (
        <details className={styles.review} id="yutai-review">
          <summary>
            <span>要確認</span>
            <strong>{reviewCount}件</strong>
            <small>根拠がないものは自動で決めません</small>
          </summary>
          <div className={styles.reviewBody}>
            {unknownEntitlements.length > 0 && (
              <section>
                <h2>状態を確認する優待</h2>
                <p>権利は確認できていますが、申込・利用開始などの状態を旧履歴から断定できないものです。</p>
                <div className={styles.reviewList}>
                  {unknownEntitlements.map((entitlement) => (
                    <article className={styles.reviewCard} key={entitlement.id}>
                      <div className={styles.reviewHeading}>
                        <div>
                          <strong>{entitlementTitle(entitlement)}</strong>
                          <span>{benefitLabels[entitlement.benefit_kind]}</span>
                        </div>
                        <b>{statusLabels[entitlement.status]}</b>
                      </div>
                      <div className={styles.deadlineNotes}>
                        {entitlement.deadlines.map((deadline) => (
                          <span key={deadline.id}>{deadlineLabels[deadline.deadline_type]} {dateLabel(deadline.due_on, today)}{deadline.completed_at ? " ✓" : ""}</span>
                        ))}
                      </div>
                      <div className={styles.resolveRow}>
                        <label>
                          確認した状態
                          <select
                            value={statusTargets[entitlement.id] ?? ""}
                            onChange={(event) => setStatusTargets((current) => ({
                              ...current,
                              [entitlement.id]: event.target.value as Exclude<RewardV2EntitlementStatus, "unknown">,
                            }))}
                          >
                            <option value="">選択</option>
                            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <button type="button" disabled={busy || !statusTargets[entitlement.id]} onClick={() => void resolveUnknown(entitlement)}>状態を確定</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {actionableLegacy.length > 0 && (
              <section>
                <h2>旧データの整理</h2>
                <p>単位や期限の根拠が不足しているため、自動変換せず残しているデータです。</p>
                <div className={styles.reviewList}>
                  {actionableLegacy.map((reward) => (
                    <article className={styles.reviewCard} key={reward.id}>
                      <div className={styles.reviewHeading}>
                        <div>
                          <strong>{reward.title}</strong>
                          <span>{reward.company}</span>
                        </div>
                        <b>{legacyValueText(reward)}</b>
                      </div>
                      {reward.title.includes("マジカ") && <p>最後の付与日は旧期限から逆算しません。次回付与から新しいAccountで追跡します。</p>}
                      {!reward.title.includes("マジカ") && <p>高度な編集から、根拠を確認したうえで所属先を決めます。</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </details>
      )}

      <details className={styles.management}>
        <summary>高度な編集・履歴管理</summary>
        <p className={styles.managementIntro}>Lot、取得・利用履歴、残高補正、Account作成などの管理機能です。普段は閉じたままで構いません。</p>
        <div className={styles.embedded}><RewardLedgerV2Panel /></div>
      </details>

      <details className={styles.management}>
        <summary>旧台帳・撮影・全件管理</summary>
        <p className={styles.managementIntro}>撮影、画像取込、旧形式の検索・編集が必要な場合だけ開きます。</p>
        <div className={styles.embedded}><DatabaseRewardsGate scanEnabled={scanEnabled} /></div>
      </details>
    </main>
  );
}

function DeadlineGroupView({ group, today }: { group: DeadlineGroup; today: string }) {
  const overdue = group.date < today;
  return (
    <section className={`${styles.deadlineGroup} ${overdue ? styles.overdueGroup : ""}`}>
      <header className={styles.deadlineHeader}>
        <div>
          <strong>{dateLabel(group.date, today)}</strong>
          <span>{overdue ? "期限超過" : group.date === today ? "今日まで" : "まで"}</span>
        </div>
        <b>{group.items.length}件</b>
      </header>
      <div className={styles.deadlineRows}>
        {group.items.map((item) => (
          <div className={styles.deadlineRow} key={item.id}>
            <div className={styles.itemMain}>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </div>
            <div className={styles.itemValue}>
              <b>{item.value}</b>
              <span>{item.source}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
