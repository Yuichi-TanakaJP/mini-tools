"use client";

import { useMemo, useState } from "react";
import SimpleInputToolLayout from "@/components/SimpleInputToolLayout";
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

function countChars(text: string): number {
  return Array.from(text).length;
}

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
    const lines = text.length ? text.split(/\r?\n/).length : 0;
    return { raw, noSpace, xEstimated, x140Remaining, lines };
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

  const isEmpty = text.trim().length === 0;
  const isOver = stats.x140Remaining < 0;
  // 0〜140の進捗バー用 (超過時は100%)
  const progressPct = isEmpty ? 0 : Math.min((stats.xEstimated / 140) * 100, 100);

  return (
    <SimpleInputToolLayout
      badge="𝕏 X投稿向け"
      title="X投稿文字数カウント"
      description="140字に収めたい投稿文を貼るだけで確認できます。URL・絵文字も正確に推定。"
      shareText="X投稿文字数カウント：140字に収まるかを確認できる"
      footerNote="※入力はこの端末（ブラウザ）にのみ保存されます（localStorage）。"
      maxWidth={820}
      resultColumnWidth={260}
      mobileBreakpoint={600}
      inputPanel={
        <div className="charcount-input-col">
          <div style={{
            background: "var(--color-bg-card)",
            borderRadius: 18,
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
            overflow: "hidden",
            height: "100%",
            display: "flex",
            flexDirection: "column",
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
              value={text}
              onChange={(e) => onChange(e.target.value)}
              placeholder={"例:\n日経平均は反発。半導体株が支えた一方で、内需は弱め。\n#日経平均 #日本株"}
              style={{
                flex: 1,
                display: "block",
                width: "100%",
                minHeight: 200,
                padding: "14px 16px",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: 15,
                lineHeight: 1.8,
                background: "transparent",
                color: "var(--color-text)",
                boxSizing: "border-box",
              }}
            />
            <div style={{
              padding: "8px 16px 12px",
              borderTop: "1px solid var(--color-border)",
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}>
              {stats.lines > 0 ? `${stats.lines} 行` : "テキストを入力してください"}
            </div>
          </div>
        </div>
      }
      resultPanel={
        <div className="charcount-result-col">
          <div style={{
            background: "var(--color-bg-card)",
            borderRadius: 18,
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
            padding: "20px 20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}>

            {/* X推定文字数 */}
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--color-text-muted)",
                letterSpacing: 0.4,
                marginBottom: 4,
              }}>
                X推定文字数
              </div>
              <div style={{
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: -1.5,
                lineHeight: 1,
                fontFamily: "ui-monospace, monospace",
                color: isEmpty ? "var(--color-text-muted)" : isOver ? "var(--color-error)" : "var(--color-text)",
                transition: "color 0.2s",
              }}>
                {isEmpty ? "—" : stats.xEstimated}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                URL=23 / 絵文字=2 / CJK=2 の推定
              </div>
            </div>

            {/* プログレスバー */}
            <div>
              <div style={{
                height: 6,
                borderRadius: 999,
                background: "var(--color-bg-input)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  borderRadius: 999,
                  background: isOver
                    ? "var(--color-error)"
                    : progressPct > 80
                    ? "var(--color-warning)"
                    : "linear-gradient(90deg, var(--color-accent) 0%, #60a5fa 100%)",
                  transition: "width 0.2s, background 0.2s",
                }} />
              </div>
            </div>

            {/* 140字残り */}
            <div style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: isOver ? "#fef2f2" : isEmpty ? "var(--color-bg-input)" : "var(--color-accent-sub)",
              border: `1px solid ${isOver ? "#fecaca" : isEmpty ? "var(--color-border)" : "#c7d2fe"}`,
              transition: "background 0.2s, border-color 0.2s",
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: isOver ? "var(--color-error)" : "var(--color-text-muted)",
                marginBottom: 2,
              }}>
                140字 残り
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: -0.5,
                fontFamily: "ui-monospace, monospace",
                color: isOver ? "var(--color-error)" : isEmpty ? "var(--color-text-muted)" : "var(--color-accent)",
              }}>
                {isEmpty ? "—" : stats.x140Remaining}
              </div>
              {!isEmpty && (
                <div style={{ fontSize: 11, color: isOver ? "var(--color-error)" : "var(--color-accent)", fontWeight: 600, marginTop: 2 }}>
                  {isOver ? `${Math.abs(stats.x140Remaining)}字オーバー` : "OK"}
                </div>
              )}
            </div>

            {/* アクセントライン */}
            <div style={{
              height: 2,
              borderRadius: 999,
              background: "linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-sub) 100%)",
              opacity: isEmpty ? 0.2 : 1,
              transition: "opacity 0.2s",
            }} />

            {/* サブ統計 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--color-bg-input)",
                border: "1px solid var(--color-border)",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: 0.3 }}>
                  文字数
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "ui-monospace, monospace", marginTop: 2 }}>
                  {isEmpty ? "—" : stats.raw}
                </div>
              </div>
              <div style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--color-bg-input)",
                border: "1px solid var(--color-border)",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: 0.3, lineHeight: 1.3 }}>
                  スペース除外
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "ui-monospace, monospace", marginTop: 2 }}>
                  {isEmpty ? "—" : stats.noSpace}
                </div>
              </div>
            </div>

            {/* ボタン */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={copyText}
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
                本文をコピー
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
              ※返信先頭の自動メンションや添付メディア 0カウントは未反映です。
            </div>
          </div>
        </div>
      }
    />
  );
}
