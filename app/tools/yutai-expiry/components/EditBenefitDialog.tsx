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

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>優待名 *</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="例：QUOカード / 食事券 / クーポン"
              autoFocus
            />
          </label>

          <div className={styles.row2}>
            <label className={styles.field}>
              <span>企業名 *</span>
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

          <label className={styles.field}>
            <span>リンク（任意）</span>
            <input
              type="url"
              value={draft.link}
              onChange={(e) => setDraft({ ...draft, link: e.target.value })}
              placeholder="例：https://example.com"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <div className={styles.field}>
            <span>管理方法</span>
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tabBtn} ${
                  draft.trackMode === "count" ? styles.tabActive : ""
                }`}
                onClick={() => setDraft({ ...draft, trackMode: "count" })}
              >
                枚数（券・複数枚）
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${
                  draft.trackMode === "amount" ? styles.tabActive : ""
                }`}
                onClick={() => setDraft({ ...draft, trackMode: "amount" })}
              >
                金額（残高・ポイント）
              </button>
            </div>
          </div>

          {draft.trackMode === "count" ? (
            <div className={styles.row2}>
              <label className={styles.field}>
                <span>枚数 *</span>
                <input
                  value={draft.qty}
                  onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
                  placeholder="例：3"
                  inputMode="numeric"
                />
              </label>

              <label className={styles.field}>
                <span>1枚あたり額面（任意）</span>
                <input
                  value={draft.unitYen}
                  onChange={(e) =>
                    setDraft({ ...draft, unitYen: e.target.value })
                  }
                  placeholder="例：1000"
                  inputMode="numeric"
                />
                {!draft.unitYen.trim() && (
                  <span className={styles.fieldHint}>
                    未入力だと「もらった」「使った」など金額集計に反映されません
                  </span>
                )}
              </label>
            </div>
          ) : (
            <label className={styles.field}>
              <span>残高（円）*</span>
              <input
                value={draft.balanceYen}
                onChange={(e) =>
                  setDraft({ ...draft, balanceYen: e.target.value })
                }
                placeholder="例：1000"
                inputMode="numeric"
              />
            </label>
          )}

          <label className={styles.field}>
            <span>メモ</span>
            <textarea
              value={draft.memo}
              onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
              placeholder="使える店舗 / 条件 / 期限の補足など"
              rows={3}
            />
          </label>
        </div>

        {draftError ? (
          <div className={styles.errorBox} role="alert">
            {draftError}
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
            {editMode === "add" ? "追加" : "保存"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
