"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ShareButtons from "@/components/ShareButtonsSuspended";
import MonetizeBar from "@/components/MonetizeBar";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "mini_tools_charcount_text_v1";

// 絵文字などでlengthズレが出ないように Array.from を使う
function countChars(text: string): number {
  return Array.from(text).length;
}

// スペース/改行/タブ + 全角スペースを除外
function stripSpacesAndNewlines(text: string): string {
  return text.replace(/[\s\u3000]/g, "");
}

export default function CharCountToolPage() {
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const stats = useMemo(() => {
    const raw = countChars(text);
    const noSpace = countChars(stripSpacesAndNewlines(text));
    const x140Remaining = 140 - raw;
    const x280Remaining = 280 - raw;
    const lines = text.length ? text.split(/\r?\n/).length : 0;

    return { raw, noSpace, x140Remaining, x280Remaining, lines };
  }, [text]);

  const onChange = (v: string) => {
    setText(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

  const copyText = async () => {
    track("action_clicked", { action: "copy_text" });
    try {
      await navigator.clipboard.writeText(text);
      alert("本文をコピーしました！");
    } catch {
      alert("コピーに失敗しました（ブラウザ設定をご確認ください）");
    }
  };

  const clearAll = () => {
    track("action_clicked", { action: "clear" });
    setText("");
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

      <h1 style={{ fontSize: 24, marginBottom: 6 }}>文字数カウント</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        文章を貼るだけで文字数を確認できます（X 140/280の残りも表示）。
      </p>

      <div style={{ marginTop: 14 }}>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            "例:\n日経平均+1.81%、TOPIX+0.64%...\n#日経平均 #TOPIX ..."
          }
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
          行数：{stats.lines}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}
          >
            <div style={{ fontSize: 13, opacity: 0.8 }}>文字数（そのまま）</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.raw}</div>
          </div>

          <div
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}
          >
            <div style={{ fontSize: 13, opacity: 0.8 }}>スペース/改行除外</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.noSpace}</div>
          </div>

          <div
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}
          >
            <div style={{ fontSize: 13, opacity: 0.8 }}>X 140字 残り</div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: stats.x140Remaining < 0 ? "#b91c1c" : "inherit",
              }}
            >
              {stats.x140Remaining}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {stats.x140Remaining < 0 ? "オーバーしています" : "OK"}
            </div>
          </div>

          <div
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}
          >
            <div style={{ fontSize: 13, opacity: 0.8 }}>X 280字 残り</div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: stats.x280Remaining < 0 ? "#b91c1c" : "inherit",
              }}
            >
              {stats.x280Remaining}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {stats.x280Remaining < 0 ? "オーバーしています" : "OK"}
            </div>
          </div>
        </div>

        <div
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}
        >
          <button
            onClick={copyText}
            style={{
              padding: "10px 12px",
              border: "1px solid #111",
              borderRadius: 10,
            }}
          >
            本文をコピー
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

      <ShareButtons text="文字数カウント：文章を貼るだけでX/投稿の文字数を確認できる" />
      <MonetizeBar />

      <div style={{ marginTop: 24, fontSize: 12, opacity: 0.75 }}>
        ※入力はこの端末（ブラウザ）にのみ保存されます（localStorage）。
      </div>
    </main>
  );
}
