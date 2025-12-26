// app/tools/total/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ShareButtons from "@/components/ShareButtons";
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

export default function TotalToolPage() {
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

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/"
          onClick={() => track("nav_clicked", { to: "home_from_tool" })}
          style={{
            display: "inline-block",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #999",
            textDecoration: "none",
          }}
        >
          ← ツール一覧へ
        </Link>
      </div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>合計計算ツール</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        数字を1行ずつ入れるだけで合計します（例：1200 / 300 / -50）。
      </p>

      <div style={{ marginTop: 14 }}>
        <textarea
          value={lines}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"例:\n1200\n300\n-50"}
          rows={10}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          入力された数値：{nums.length}件
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          border: "1px solid #111",
          borderRadius: 14,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.8 }}>合計</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>
          {total.toLocaleString()}
        </div>

        <div
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}
        >
          <button
            onClick={copyTotal}
            style={{
              padding: "10px 12px",
              border: "1px solid #111",
              borderRadius: 10,
            }}
          >
            合計をコピー
          </button>
          <button
            onClick={clearAll}
            style={{
              padding: "10px 12px",
              border: "1px solid #999",
              borderRadius: 10,
            }}
          >
            クリア
          </button>
        </div>
      </div>

      <ShareButtons text="合計計算ツール：数字を貼るだけで合計できる" />
      <MonetizeBar />

      <div style={{ marginTop: 24, fontSize: 12, opacity: 0.75 }}>
        ※入力はこの端末（ブラウザ）にのみ保存されます（localStorage）。
      </div>
    </main>
  );
}
