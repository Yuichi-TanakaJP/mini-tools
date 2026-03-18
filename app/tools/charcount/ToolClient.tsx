"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ShareButtons from "@/components/ShareButtonsSuspended";
import MonetizeBar from "@/components/MonetizeBar";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "mini_tools_charcount_text_v1";
const X_URL_LENGTH = 23;
const ZERO_WIDTH_STRIP_RE = /[\u200B\u200C\u2060\uFEFF]/g;
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/gi;
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR_PAIR_RE = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
const KEYCAP_RE = /^[#*0-9]\uFE0F?\u20E3$/u;
const TRAILING_URL_PUNCTUATION_RE = /[.,!?;:)\]}]+$/;
const graphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;

// 絵文字などでlengthズレが出ないように Array.from を使う
function countChars(text: string): number {
  return Array.from(text).length;
}

// スペース/改行/タブ + 全角スペースを除外
function stripSpacesAndNewlines(text: string): string {
  return text.replace(/[\s\u3000]/g, "");
}

function normalizeForX(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(ZERO_WIDTH_STRIP_RE, "");
}

function isXWeightOne(codePoint: number): boolean {
  return (
    (codePoint >= 0x0000 && codePoint <= 0x10ff) ||
    (codePoint >= 0x2000 && codePoint <= 0x200d) ||
    (codePoint >= 0x2010 && codePoint <= 0x201f) ||
    (codePoint >= 0x2032 && codePoint <= 0x2037)
  );
}

function splitGraphemes(text: string): string[] {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

function isEmojiLikeGrapheme(grapheme: string): boolean {
  return (
    EMOJI_RE.test(grapheme) ||
    REGIONAL_INDICATOR_PAIR_RE.test(grapheme) ||
    KEYCAP_RE.test(grapheme)
  );
}

function splitUrlAndTrailingPunctuation(value: string): {
  urlPart: string;
  trailingPart: string;
} {
  const trimmedTrailing = value.match(TRAILING_URL_PUNCTUATION_RE)?.[0] ?? "";
  if (!trimmedTrailing) return { urlPart: value, trailingPart: "" };
  return {
    urlPart: value.slice(0, value.length - trimmedTrailing.length),
    trailingPart: trimmedTrailing,
  };
}

function countPlainTextForX(text: string): number {
  let total = 0;

  for (const grapheme of splitGraphemes(text)) {
    if (!grapheme) continue;

    if (isEmojiLikeGrapheme(grapheme)) {
      total += 2;
      continue;
    }

    for (const char of grapheme) {
      const codePoint = char.codePointAt(0);
      if (codePoint == null) continue;
      total += isXWeightOne(codePoint) ? 1 : 2;
    }
  }

  return total;
}

function countForX(text: string): number {
  const normalized = normalizeForX(text);
  let total = 0;
  let lastIndex = 0;

  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_RE.exec(normalized)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const { urlPart, trailingPart } = splitUrlAndTrailingPunctuation(match[0]);

    total += countPlainTextForX(normalized.slice(lastIndex, start));
    total += X_URL_LENGTH;
    total += countPlainTextForX(trailingPart);
    lastIndex = end;

    if (!urlPart) {
      total -= X_URL_LENGTH;
      total += countPlainTextForX(match[0]);
    }
  }

  total += countPlainTextForX(normalized.slice(lastIndex));
  return total;
}

export default function ToolClient() {
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
    const xEstimated = countForX(text);
    const x140Remaining = 140 - xEstimated;
    const x280Remaining = 280 - xEstimated;
    const lines = text.length ? text.split(/\r?\n/).length : 0;

    return { raw, noSpace, xEstimated, x140Remaining, x280Remaining, lines };
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
            <div style={{ fontSize: 13, opacity: 0.8 }}>X推定文字数</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.xEstimated}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              URL=23 / 絵文字=2 / CJK=2 の推定
            </div>
          </div>

          <div
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}
          >
            <div style={{ fontSize: 13, opacity: 0.8 }}>X推定 140字 残り</div>
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
            <div style={{ fontSize: 13, opacity: 0.8 }}>X推定 280字 残り</div>
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

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
          ※X推定は weighted character counting を参考にした近似です。返信先頭の自動メンションや添付メディア 0カウントは未反映です。
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
