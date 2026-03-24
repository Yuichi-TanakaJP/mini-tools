"use client";

import { useMemo, useState } from "react";
import ShareButtons from "@/components/ShareButtonsSuspended";
import MonetizeBar from "@/components/MonetizeBar";
import { track } from "@/lib/analytics";
import Link from "next/link";

const STORAGE_KEY = "mini_tools_total_lines_v1";

function parseNumbers(text: string): number[] {
  // 1行ごとに数字を抽出（「1,200」「 300円」みたいなのも許容）
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cleaned = line.replace(/,/g, "").replace(/[^\d\.\-]/g, "");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : NaN;
    })
    .filter((n) => !Number.isNaN(n));
}

export default function ToolClient() {
  const [lines, setLines] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const nums = useMemo(() => parseNumbers(lines), [lines]);
  const total = useMemo(() => nums.reduce((a, b) => a + b, 0), [nums]);

  const onChange = (v: string) => {
    setLines(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

  const copyTotal = async () => {
    track("action_clicked", { action: "copy_total" });
    try {
      await navigator.clipboard.writeText(String(total));
      alert("合計をコピーしました！");
    } catch {
      alert("コピーに失敗しました（ブラウザ設定をご確認ください）");
    }
  };

  const clearAll = () => {
    track("action_clicked", { action: "clear" });
    setLines("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const isEmpty = lines.trim().length === 0;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 48px" }}>

      {/* ナビ */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/"
          onClick={() => track("nav_clicked", { to: "home_from_tool" })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid var(--color-border-strong)",
            textDecoration: "none",
            color: "var(--color-text-sub)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ← ツール一覧
        </Link>
      </div>

      {/* ヒーロー */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
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
        }}>
          🧮 合計計算
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.4 }}>
          数字を貼るだけで合計
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--color-text-sub)" }}>
          1行1つの数字を入れるだけ。カンマ・円・マイナスも自動で読み取ります。
        </p>
      </div>

      {/* 2カラムレイアウト */}
      <div className="total-layout">

        {/* 左: 入力エリア */}
        <div className="total-input-col">
          <div style={{
            background: "var(--color-bg-card)",
            borderRadius: 18,
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "12px 16px 8px",
              borderBottom: "1px solid var(--color-border)",
              fontSize: 11,
              fontWeight: 800,
              color: "var(--color-text-muted)",
              letterSpacing: 0.4,
            }}>
              INPUT
            </div>
            <textarea
              value={lines}
              onChange={(e) => onChange(e.target.value)}
              placeholder={"1200\n300\n-50"}
              style={{
                display: "block",
                width: "100%",
                padding: "14px 16px",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: 16,
                lineHeight: 1.8,
                background: "transparent",
                color: "var(--color-text)",
                fontFamily: "ui-monospace, monospace",
                boxSizing: "border-box",
              }}
              rows={10}
            />
            <div style={{
              padding: "8px 16px 12px",
              borderTop: "1px solid var(--color-border)",
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}>
              {nums.length > 0 ? `${nums.length} 件パース済み` : "数字を1行ずつ入力してください"}
            </div>
          </div>
        </div>

        {/* 右: 結果エリア */}
        <div className="total-result-col">
          <div style={{
            background: "var(--color-bg-card)",
            borderRadius: 18,
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
            padding: "20px 20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            {/* 合計表示 */}
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--color-text-muted)",
                letterSpacing: 0.4,
                marginBottom: 6,
              }}>
                合計
              </div>
              <div style={{
                fontSize: 38,
                fontWeight: 800,
                letterSpacing: -1,
                color: isEmpty ? "var(--color-text-muted)" : "var(--color-text)",
                lineHeight: 1.1,
                fontFamily: "ui-monospace, monospace",
              }}>
                {isEmpty ? "—" : total.toLocaleString()}
              </div>
            </div>

            {/* アクセントライン */}
            <div style={{
              height: 2,
              borderRadius: 999,
              background: "linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-sub) 100%)",
              opacity: isEmpty ? 0.2 : 1,
              transition: "opacity 0.2s",
            }} />

            {/* ボタン */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={copyTotal}
                disabled={isEmpty}
                style={{
                  padding: "11px 16px",
                  border: "none",
                  borderRadius: 12,
                  background: isEmpty ? "var(--color-bg-input)" : "var(--color-accent)",
                  color: isEmpty ? "var(--color-text-muted)" : "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isEmpty ? "default" : "pointer",
                  transition: "background 0.15s",
                  textAlign: "center",
                }}
              >
                合計をコピー
              </button>
              <button
                onClick={clearAll}
                disabled={isEmpty}
                style={{
                  padding: "11px 16px",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: 12,
                  background: "var(--color-bg-input)",
                  color: isEmpty ? "var(--color-text-muted)" : "var(--color-text-sub)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isEmpty ? "default" : "pointer",
                  transition: "background 0.15s",
                  textAlign: "center",
                }}
              >
                クリア
              </button>
            </div>

            {/* 注記 */}
            <div style={{
              fontSize: 11,
              color: "var(--color-text-muted)",
              lineHeight: 1.6,
              paddingTop: 4,
              borderTop: "1px solid var(--color-border)",
            }}>
              データはこの端末にのみ保存されます
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <ShareButtons text="合計計算ツール：数字を貼るだけで合計できる" />
        <MonetizeBar />
      </div>

      <style>{`
        .total-layout {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 560px) {
          .total-layout {
            grid-template-columns: 1fr;
          }
          .total-result-col {
            order: -1;
          }
        }
      `}</style>
    </main>
  );
}
