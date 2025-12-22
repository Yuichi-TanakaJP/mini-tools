"use client";

import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";

type ShareMethod = "x" | "facebook" | "email" | "copy";

type Props = {
  /** ツイート文などに使うテキスト（従来互換） */
  text: string;

  /** 任意：シェアしたいURLを固定したい場合（未指定なら window.location.href） */
  url?: string;

  /** 任意：表示するサービスを絞る */
  methods?: ShareMethod[];

  /** 任意：アイコンのサイズ（px） */
  size?: number;

  /** 任意：アイコンだけ表示したい場合は true */
  iconsOnly?: boolean;

  /** 任意：ラベルの先頭に付ける見出し（例：シェア） */
  label?: string;
};

const DEFAULT_METHODS: ShareMethod[] = ["x", "facebook", "email", "copy"];

export default function ShareButtons({
  text,
  url,
  methods = DEFAULT_METHODS,
  size = 44,
  iconsOnly = true,
  label,
}: Props) {
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    if (url) {
      setCurrentUrl(url);
      return;
    }
    // CSR only
    setCurrentUrl(window.location.href);
  }, [url]);

  const shareLinks = useMemo(() => {
    const u = currentUrl || "";
    const encUrl = encodeURIComponent(u);
    const encText = encodeURIComponent(text);

    return {
      x: `https://x.com/intent/tweet?text=${encText}&url=${encUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      email: `mailto:?subject=${encText}&body=${encUrl}`,
    };
  }, [currentUrl, text]);

  const onShare = (method: ShareMethod) => {
    track("share_clicked", { method });
  };

  const onCopy = async () => {
    onShare("copy");
    const u = currentUrl || "";
    try {
      await navigator.clipboard.writeText(u);
      // 軽いフィードバック（alertは好みで外してOK）
      // 既存の世界観的に控えめにしたいので console でもOK
      alert("リンクをコピーしました！");
    } catch {
      alert("コピーに失敗しました（ブラウザ設定をご確認ください）");
    }
  };

  const renderIcon = (m: ShareMethod) => {
    // シンプルに「それっぽい」SVG（外部ライブラリ不要）
    // こだわりたくなったら later: react-icons に差し替えもOK
    switch (m) {
      case "x":
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M18.9 2H22l-6.8 7.8L23 22h-6.5l-5.1-6.6L5.7 22H2.6l7.4-8.5L1 2h6.7l4.6 6L18.9 2Zm-1.1 18h1.7L6.8 3.9H5L17.8 20Z"
              fill="currentColor"
            />
          </svg>
        );
      case "facebook":
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M13.5 22v-8h2.7l.4-3h-3.1V9.2c0-.9.2-1.5 1.6-1.5H17V5.1c-.4-.1-1.6-.2-3.1-.2-3 0-5 1.8-5 5.2V11H6v3h2.9v8h4.6Z"
              fill="currentColor"
            />
          </svg>
        );
      case "email":
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5L4 8V6l8 5 8-5v2Z"
              fill="currentColor"
            />
          </svg>
        );
      case "copy":
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z"
              fill="currentColor"
            />
          </svg>
        );
    }
  };

  const labelFor = (m: ShareMethod) => {
    switch (m) {
      case "x":
        return "X";
      case "facebook":
        return "Facebook";
      case "email":
        return "メール";
      case "copy":
        return "コピー";
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      {label ? (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          {label}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {methods.map((m) => {
          if (m === "copy") {
            return (
              <button
                key={m}
                type="button"
                onClick={onCopy}
                aria-label="リンクをコピー"
                title="リンクをコピー"
                style={iconButtonStyle(size)}
              >
                {renderIcon(m)}
                {!iconsOnly ? (
                  <span style={labelStyle}>{labelFor(m)}</span>
                ) : null}
              </button>
            );
          }

          const href =
            m === "x"
              ? shareLinks.x
              : m === "facebook"
              ? shareLinks.facebook
              : shareLinks.email;

          return (
            <a
              key={m}
              href={href || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShare(m)}
              aria-label={`${labelFor(m)}でシェア`}
              title={`${labelFor(m)}でシェア`}
              style={iconButtonStyle(size)}
            >
              {renderIcon(m)}
              {!iconsOnly ? (
                <span style={labelStyle}>{labelFor(m)}</span>
              ) : null}
            </a>
          );
        })}
      </div>

      <style>{css}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
};

function iconButtonStyle(size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: 999,

    // ★丸枠・背景を消す
    border: "none",
    background: "transparent",

    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    color: "rgba(0,0,0,0.78)",
    cursor: "pointer",
    userSelect: "none",

    // ★“軽い”ホバーだけ
    transition: "transform .12s ease, opacity .12s ease",
    padding: 0,
  };
}

const css = `
  @media (hover: hover) and (pointer: fine) {
    a[aria-label*="でシェア"]:hover,
    button[aria-label*="コピー"]:hover {
      transform: translateY(-1px);
      opacity: 1;
    }
    a[aria-label*="でシェア"]:active,
    button[aria-label*="コピー"]:active {
      transform: translateY(0px);
      opacity: 0.85;
    }
  }

  /* ★ ここが重要：aタグ由来の丸・枠・フォーカスを完全に殺す */
  a {
    background: transparent !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }

  a:focus,
  a:focus-visible {
    outline: none !important;
    box-shadow: none !important;
  }

  button {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: transparent;
  }
`;
