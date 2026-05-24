"use client";

import { useState } from "react";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

type ScanResult = {
  title: string | null;
  company: string | null;
  expiresOn: string | null;
  amountYen: number | null;
  quantity: number | null;
  confidence: number;
};

async function resizeToJpegBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const longer = Math.max(bitmap.width, bitmap.height);
  const scale = longer > MAX_EDGE ? MAX_EDGE / longer : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("canvas.toBlob failed");

  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), mimeType: "image/jpeg" };
}

export default function ScanPocPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setRawResponse(null);
    setElapsedMs(null);
    setModelUsed(null);
    setPreviewUrl(URL.createObjectURL(file));

    setPending(true);
    const startedAt = performance.now();
    try {
      const { base64, mimeType } = await resizeToJpegBase64(file);
      const res = await fetch("/api/yutai-expiry/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const json = await res.json();
      setRawResponse(JSON.stringify(json, null, 2));
      if (json.model) setModelUsed(json.model);
      if (!res.ok) {
        if (json.retryable) {
          setError(
            `Gemini が混雑中 / レート上限です（${json.upstreamStatus}）。数秒〜数分待って再試行してください。続くようなら GEMINI_MODEL を gemini-2.5-flash に切り替えるのも有効です。`
          );
        } else {
          setError(json.error ?? `HTTP ${res.status}`);
        }
      } else {
        setResult(json.result as ScanResult);
        console.log("[scan-poc] result", json.result);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setElapsedMs(Math.round(performance.now() - startedAt));
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>
        優待スキャン PoC (Phase 1)
      </h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        撮影またはファイル選択した <b>画像</b>（JPEG / PNG / HEIC など）を Gemini に送信し、抽出結果を表示します。
        確認用のため、本番の追加フォームとは繋がっていません。
        PDF を試したい場合は、先にスクリーンショット等で画像化してください。
      </p>

      <div
        style={{
          padding: 12,
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 6,
          fontSize: 13,
          lineHeight: 1.6,
          marginBottom: 16,
        }}
      >
        <strong>⚠️ 送信前に確認</strong>
        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
          <li>
            Gemini API の無料枠は、送信画像と生成結果が Google のサービス改善・モデル学習に使われる可能性があります（
            <a
              href="https://ai.google.dev/gemini-api/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              公式 terms
            </a>
            ）。
          </li>
          <li>
            検証時は <b>氏名 / 会員番号 / QR / バーコード / 住所 / メール本文</b>
             などをマスクするか、ダミー画像で試してください。
          </li>
          <li>Billing は有効化しない（無料枠内に留める）。</li>
        </ul>
      </div>

      <details
        style={{
          padding: 10,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>
          精度評価のチェック観点
        </summary>
        <ul style={{ margin: "8px 0 0 18px", padding: 0, lineHeight: 1.7 }}>
          <li>期限日（YYYY-MM-DD で正しく取れたか）</li>
          <li>会社名</li>
          <li>券種 / 優待名</li>
          <li>金額 / 枚数</li>
          <li>注意書きを誤って金額等に混入させていないか</li>
        </ul>
        <p style={{ margin: "8px 0 0", color: "#666" }}>
          外したフィールドをメモしておくと、プロンプト調整やモデル変更の判断材料になります。
        </p>
      </details>

      <label
        style={{
          display: "inline-block",
          padding: "10px 16px",
          background: "#1f6feb",
          color: "white",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        撮影 / 画像を選ぶ
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {pending && <p style={{ marginTop: 12 }}>解析中…</p>}

      {previewUrl && (
        <div style={{ marginTop: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="preview"
            style={{ maxWidth: "100%", borderRadius: 6, border: "1px solid #ddd" }}
          />
        </div>
      )}

      {(elapsedMs != null || modelUsed) && (
        <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
          {modelUsed && (
            <>
              モデル: <code>{modelUsed}</code>（
              <a
                href="https://ai.google.dev/gemini-api/docs/rate-limits"
                target="_blank"
                rel="noopener noreferrer"
              >
                rate limits
              </a>
               /{" "}
              <a
                href="https://ai.google.dev/gemini-api/docs/pricing"
                target="_blank"
                rel="noopener noreferrer"
              >
                pricing
              </a>
              ）
            </>
          )}
          {modelUsed && elapsedMs != null && " ／ "}
          {elapsedMs != null && <>所要時間: {elapsedMs} ms</>}
        </p>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>抽出結果</h2>
          <dl style={{ fontSize: 14, lineHeight: 1.7 }}>
            <Row k="優待名" v={result.title} />
            <Row k="企業" v={result.company} />
            <Row k="有効期限" v={result.expiresOn} />
            <Row
              k="金額"
              v={result.amountYen != null ? `¥${result.amountYen.toLocaleString()}` : null}
            />
            <Row k="枚数" v={result.quantity != null ? `${result.quantity}枚` : null} />
            <Row k="確信度" v={result.confidence.toFixed(2)} />
          </dl>
        </section>
      )}

      {rawResponse && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#666" }}>
            生レスポンス JSON
          </summary>
          <pre
            style={{
              background: "#f6f8fa",
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              overflow: "auto",
            }}
          >
            {rawResponse}
          </pre>
        </details>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <dt style={{ width: 90, color: "#666" }}>{k}</dt>
      <dd style={{ margin: 0, fontWeight: 500 }}>{v ?? "—"}</dd>
    </div>
  );
}
