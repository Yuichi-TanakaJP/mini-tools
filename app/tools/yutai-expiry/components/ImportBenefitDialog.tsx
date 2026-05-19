"use client";

import React from "react";
import styles from "../ToolClient.module.css";

type Props = {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  importText: string;
  setImportText: (next: string) => void;
  importError: string | null;
  onImportReplace: () => void; // doImport(false)
  onImportMerge: () => void; // doImport(true)
};

export default function ImportBenefitDialog({
  dialogRef,
  importText,
  setImportText,
  importError,
  onImportReplace,
  onImportMerge,
}: Props) {
  // 全データ破棄は不可逆なので置き換え時のみ確認を挟む
  const handleReplace = () => {
    const ok = window.confirm(
      "現在のデータをすべて破棄して置き換えます。よろしいですか？（元に戻せません）"
    );
    if (ok) onImportReplace();
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog}>
      <form method="dialog" className={styles.dialogInner}>
        <div className={styles.dialogHeader}>
          <div className={styles.dialogTitle}>インポート</div>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => dialogRef.current?.close()}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {importError ? (
          <div className={styles.errorBox}>{importError}</div>
        ) : null}

        <div className={styles.formGrid}>
          <div className={styles.help}>
            配列JSONを貼り付けてください。旧バージョン形式も自動で取り込みます。
          </div>
          <textarea
            className={styles.bigTextarea}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='例：[{ "id":"...", "title":"...", "expiresOn":"2026-01-31", ... }]'
          />
        </div>

        <div className={styles.dialogBtns}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => dialogRef.current?.close()}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`${styles.ghostBtn} ${styles.dangerBtn}`}
            onClick={handleReplace}
            title="現在のデータを全消去して置き換える"
          >
            すべて置き換え
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onImportMerge}
            title="既存に追加マージ（同じidは上書き、それ以外は保持）"
          >
            マージして取り込み
          </button>
        </div>
      </form>
    </dialog>
  );
}
