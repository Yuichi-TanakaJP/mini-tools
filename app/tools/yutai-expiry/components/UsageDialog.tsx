"use client";

import React from "react";
import styles from "../ToolClient.module.css";
import type { BenefitItemV2 } from "../benefits/store";

type Props = {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  item: BenefitItemV2 | null;
  kind: "use" | "add";
  amount: string; // count: 枚数 / amount: 金額
  setAmount: (v: string) => void;
  // count モード時の任意「金額入力」（unitYen が必要。amount モードでは無視）
  amountYen: string;
  setAmountYen: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  error: string | null;
  onSubmit: () => void;
};

export default function UsageDialog({
  dialogRef,
  item,
  kind,
  amount,
  setAmount,
  amountYen,
  setAmountYen,
  note,
  setNote,
  error,
  onSubmit,
}: Props) {
  if (!item) return <dialog ref={dialogRef} className={styles.dialog} />;

  const isAmount = item.trackMode === "amount";
  const unitLabel = isAmount ? "金額（円）" : "枚数";
  const verb = kind === "use" ? "使う" : "追加する";
  const title = `${verb}（${item.title}）`;
  const remaining = item.remaining ?? 0;

  // クイック入力候補（mode と use/add で変える）
  const chips = isAmount
    ? kind === "use"
      ? [100, 500, 1000].filter((v) => v <= remaining)
      : [500, 1000, 3000]
    : kind === "use"
    ? [1, 5, 10].filter((v) => v <= remaining)
    : [1, 5, 10];

  return (
    <dialog ref={dialogRef} className={styles.dialog}>
      <form
        method="dialog"
        className={styles.dialogInner}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className={styles.dialogHeader}>
          <div className={styles.dialogTitle}>{title}</div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => dialogRef.current?.close()}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.help}>
            現在の残量: <b>{isAmount ? `¥${remaining.toLocaleString()}` : `${remaining}枚`}</b>
          </div>

          <label className={styles.field}>
            <span>{unitLabel}{isAmount ? " *" : ""}</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={isAmount ? "例：300" : "例：1"}
              inputMode="numeric"
              autoFocus
            />
          </label>

          {!isAmount && (
            <label className={styles.field}>
              <span>
                または 金額（円）
                {item.unitYen != null
                  ? `（1枚 ¥${item.unitYen.toLocaleString()} で換算）`
                  : "（1枚あたり額面が未設定なので使えません）"}
              </span>
              <input
                value={amountYen}
                onChange={(e) => setAmountYen(e.target.value)}
                placeholder="例：3000"
                inputMode="numeric"
                disabled={item.unitYen == null || !(item.unitYen > 0)}
              />
            </label>
          )}

          {(chips.length > 0 || kind === "use") && (
            <div className={styles.kvRow}>
              {chips.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={styles.smallBtn}
                  onClick={() => setAmount(String(v))}
                >
                  {isAmount ? `¥${v.toLocaleString()}` : `${v}枚`}
                </button>
              ))}
              {kind === "use" && remaining > 0 && (
                <button
                  type="button"
                  className={styles.smallBtn}
                  onClick={() => setAmount(String(remaining))}
                >
                  全部（{isAmount ? `¥${remaining.toLocaleString()}` : `${remaining}枚`}）
                </button>
              )}
            </div>
          )}

          <label className={styles.field}>
            <span>メモ（任意）</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：コンビニで使用 / 配当でもらった など"
            />
          </label>
        </div>

        {error ? (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        ) : null}

        <div className={styles.dialogBtns}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => dialogRef.current?.close()}
          >
            キャンセル
          </button>
          <button type="submit" className={styles.primaryBtn}>
            {verb}
          </button>
        </div>
      </form>
    </dialog>
  );
}
