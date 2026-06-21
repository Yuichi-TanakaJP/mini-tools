"use client";

import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  applyBackup,
  buildBackup,
  parseBackup,
  serializeBackup,
  type ApplyMode,
  type BackupFile,
} from "@/lib/local-data-transfer";

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg-card)",
  borderRadius: 18,
  border: "1px solid var(--color-border)",
  boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  padding: "18px 18px 16px",
};

const primaryButton: React.CSSProperties = {
  padding: "11px 16px",
  border: "none",
  borderRadius: 12,
  background: "var(--color-accent)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "center",
};

const subButton: React.CSSProperties = {
  padding: "11px 16px",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 12,
  background: "var(--color-bg-input)",
  color: "var(--color-text-sub)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "center",
};

function formatDateForFilename(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ToolClient() {
  // ssr:false の dynamic import で読み込まれるため、初期化はクライアントでのみ走る。
  const [currentCount, setCurrentCount] = useState<number | null>(() => buildBackup().itemCount);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [importMode, setImportMode] = useState<ApplyMode>("merge");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    track("action_clicked", { action: "data_export" });
    try {
      const json = serializeBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mini-tools-backup-${formatDateForFilename(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("エクスポートに失敗しました。");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setError(null);
    setPending(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = parseBackup(text);
      if (result.ok && result.backup) {
        setPending(result.backup);
      } else {
        setError(result.error ?? "読み込みに失敗しました。");
      }
    };
    reader.onerror = () => setError("ファイルの読み込みに失敗しました。");
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!pending) return;
    if (importMode === "replace") {
      const ok = window.confirm(
        "「置き換え」を選んでいます。このバックアップに無いキーは削除され、端末内データが丸ごと差し替わります。よろしいですか？",
      );
      if (!ok) return;
    }
    track("action_clicked", { action: "data_import", mode: importMode });
    const res = applyBackup(pending, importMode);
    setPending(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCurrentCount(buildBackup().itemCount);
    setMessage(
      `取り込みました（${res.applied} 件を書き込み${res.removed > 0 ? ` / ${res.removed} 件を削除` : ""}）。` +
        "反映のため、各ツールのページを開き直してください。",
    );
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 48px" }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--color-accent-sub)",
            color: "var(--color-accent)",
            fontSize: 11,
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          🔄 データ引っ越し
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.4 }}>
          端末内データをバックアップ / 復元
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--color-text-sub)" }}>
          各ツールが端末内（ブラウザ）に保存しているデータを JSON でまとめて書き出し・読み込みします。
          機種変更やブラウザ移行のときに使えます。サーバーへの送信はありません。
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* エクスポート */}
        <section style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>① 書き出す（この端末から）</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            現在この端末に保存されている全データを 1 つの JSON ファイルにダウンロードします。
            {currentCount !== null && (
              <>
                {" "}
                （対象: <strong>{currentCount}</strong> 項目）
              </>
            )}
          </p>
          <button onClick={handleExport} style={primaryButton} disabled={currentCount === 0}>
            JSON をダウンロード
          </button>
        </section>

        {/* インポート */}
        <section style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>② 読み込む（別端末・復元）</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            書き出した JSON ファイルを選ぶと内容を確認できます。取り込み方法を選んで反映してください。
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            style={{ fontSize: 13, marginBottom: 14, color: "var(--color-text-sub)" }}
          />

          {pending && (
            <div
              style={{
                background: "var(--color-bg-input)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 14,
                fontSize: 13,
                color: "var(--color-text-sub)",
                lineHeight: 1.7,
              }}
            >
              <div>
                読み込んだファイル: <strong>{pending.itemCount}</strong> 項目
              </div>
              {pending.exportedAt && (
                <div style={{ color: "var(--color-text-muted)" }}>
                  書き出し日時: {new Date(pending.exportedAt).toLocaleString()}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === "merge"}
                    onChange={() => setImportMode("merge")}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <strong>追加・上書き（おすすめ）</strong>
                    <br />
                    ファイル内のキーを書き込みます。この端末にしかないデータは残ります。
                  </span>
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <strong>置き換え</strong>
                    <br />
                    ファイルに無いキーを削除し、端末内データを丸ごと差し替えます。
                  </span>
                </label>
              </div>

              <button onClick={handleImport} style={{ ...primaryButton, marginTop: 14, width: "100%" }}>
                取り込む
              </button>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: "var(--color-danger, #dc2626)", marginTop: 4 }}>{error}</div>
          )}
          {message && (
            <div style={{ fontSize: 13, color: "var(--color-accent)", marginTop: 4, lineHeight: 1.6 }}>
              {message}
            </div>
          )}
        </section>

        {/* 注記 */}
        <p style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.7, margin: 0 }}>
          ※ これは手動のバックアップ機能です（自動同期ではありません）。データはこの端末にのみ保存され、
          書き出した JSON ファイルの管理はご自身で行ってください。
        </p>
      </div>
    </main>
  );
}
