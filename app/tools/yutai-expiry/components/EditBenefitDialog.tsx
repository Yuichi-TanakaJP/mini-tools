"use client";

import React from "react";
import styles from "../ToolClient.module.css";
import type { Draft } from "../ToolClient";

type Props = {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  editMode: "add" | "edit";
  draft: Draft;
  setDraft: (next: Draft) => void;
  draftError: string | null;
  onSubmit: () => void; // upsertFromDraft
};

export default function EditBenefitDialog({
  dialogRef,
  editMode,
  draft,
  setDraft,
  draftError,
  onSubmit,
}: Props) {
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
          <div className={styles.dialogTitle}>
            {editMode === "add" ? "追加" : "編集"}
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => dialogRef.current?.close()}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {draftError ? (
          <div className={styles.errorBox}>{draftError}</div>
        ) : null}

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>タイトル *</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="例：QUOカード / 食事券 / クーポン"
              autoFocus
            />
          </label>

          <div className={styles.row2}>
            <label className={styles.field}>
              <span>企業名</span>
              <input
                value={draft.company}
                onChange={(e) =>
                  setDraft({ ...draft, company: e.target.value })
                }
                placeholder="例：ビックカメラ"
              />
            </label>

            <label className={styles.field}>
              <span>期限（YYYY-MM-DD）</span>
              <input
                value={draft.expiresOn}
                onChange={(e) =>
                  setDraft({ ...draft, expiresOn: e.target.value })
                }
                placeholder="例：2026-01-31（空なら期限なし）"
                inputMode="numeric"
              />
            </label>
          </div>

          <div className={styles.row2}>
            <label className={styles.field}>
              <span>数量</span>
              <input
                value={draft.quantity}
                onChange={(e) =>
                  setDraft({ ...draft, quantity: e.target.value })
                }
                placeholder="例：2"
                inputMode="numeric"
              />
            </label>

            <label className={styles.field}>
              <span>金額</span>
              <input
                value={draft.amountYen}
                onChange={(e) =>
                  setDraft({ ...draft, amountYen: e.target.value })
                }
                placeholder="例：1000"
                inputMode="numeric"
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>メモ</span>
            <textarea
              value={draft.memo}
              onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
              placeholder="使える店舗 / 条件 / 期限の補足など"
              rows={3}
            />
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={draft.isUsed}
              onChange={(e) => setDraft({ ...draft, isUsed: e.target.checked })}
            />
            <span>使用済みにする</span>
          </label>
        </div>

        <div className={styles.dialogBtns}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => dialogRef.current?.close()}
          >
            キャンセル
          </button>
          <button type="submit" className={styles.primaryBtn}>
            {editMode === "add" ? "追加" : "保存"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
