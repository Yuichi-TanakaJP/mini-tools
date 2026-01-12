"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { QRCodeCanvas } from "qrcode.react";
import { createPortal } from "react-dom";

type ShareMethod = "x" | "facebook" | "email" | "copy" | "qr";

type Props = {
  text?: string;
  url?: string;
  methods?: ShareMethod[];
  size?: number;
  iconsOnly?: boolean;
  label?: string;
};

const DEFAULT_METHODS: ShareMethod[] = ["x", "facebook", "email", "copy", "qr"];

export default function ShareButtons({
  text,
  url,
  methods = DEFAULT_METHODS,
  size = 44,
  iconsOnly = true,
  label,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [qrOpen, setQrOpen] = useState(false);

  const currentUrl = useMemo(() => {
    if (url) return url;

    const qs = searchParams?.toString();
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

    // base があるなら絶対URL、なければ相対URLでフォールバック
    const pathWithQuery = `${pathname}${qs ? `?${qs}` : ""}`;
    return base ? `${base}${pathWithQuery}` : pathWithQuery;
  }, [url, pathname, searchParams]);

  type ShareUrlMode = "public" | "current";

  const getShareUrl = useCallback(
    (mode: ShareUrlMode = "public") => {
      // public: 共有用（本番URL優先）
      if (mode === "public") {
        try {
          // NEXT_PUBLIC_SITE_URL があればそれを優先
          const base =
            process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
          return new URL(currentUrl || "", base).href;
        } catch {
          return process.env.NEXT_PUBLIC_SITE_URL || window.location.href;
        }
      }

      // current: 今見ているURL（開発・検証向け）
      return window.location.href;
    },
    [currentUrl]
  );

  const shareLinks = useMemo(() => {
    const u = getShareUrl();
    const encUrl = encodeURIComponent(u);
    const encText = encodeURIComponent(text ?? "");

    return {
      x: `https://x.com/intent/tweet?text=${encText}&url=${encUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      email: `mailto:?subject=${encText}&body=${encUrl}`,
    };
  }, [getShareUrl, text]);

  const onShare = (method: ShareMethod) => {
    track("share_clicked", { method });
  };

  const onCopy = async (url: string) => {
    onShare("copy");
    try {
      await navigator.clipboard.writeText(url);
      alert("リンクをコピーしました！");
    } catch {
      alert("コピーに失敗しました（ブラウザ設定をご確認ください）");
    }
  };

  const renderIcon = (m: ShareMethod) => {
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
      case "qr":
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm10-2h2v2h-2v-2Zm-2 2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm2 2h2v6h-6v-2h4v-4Zm-6 0h2v2h-2v-2Zm0 4h2v2h-2v-2Z"
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
      case "qr":
        return "QR";
    }
  };

  const renderQrModal = () => {
    if (!qrOpen) return null;
    if (typeof document === "undefined") return null; // ★ これが肝

    const raw = currentUrl || "";
    let u = raw;

    try {
      // rawが相対でも絶対でもOK。最終的に絶対URLへ正規化
      u = new URL(raw, window.location.origin).href;
    } catch {
      // 念のためフォールバック
      u = window.location.href;
    }

    return createPortal(
      <div style={overlayStyle} onClick={() => setQrOpen(false)}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
            このページを共有
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <QRCodeCanvas value={u} size={180} />
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => onCopy(u)}
              style={modalBtnStyle}
            >
              URLコピー
            </button>
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              style={modalBtnStyle}
            >
              閉じる
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
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
                onClick={() => onCopy(getShareUrl())}
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

          if (m === "qr") {
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onShare("qr");
                  setQrOpen(true);
                }}
                aria-label="QRで共有"
                title="QRで共有"
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

      {renderQrModal()}

      <style>{css}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.8 };

function iconButtonStyle(size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: 999,
    border: "none",
    background: "transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    color: "rgba(0,0,0,0.78)",
    cursor: "pointer",
    userSelect: "none",
    transition: "transform .12s ease, opacity .12s ease",
    padding: 0,
  };
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start", // center → flex-start
  paddingTop: "var(--header-h, 88px)",
  paddingLeft: "16px",
  paddingRight: "16px",
  paddingBottom: "16px",
  overflowY: "auto", // 低い画面でも操作できる
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
  width: "min(92vw, 360px)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
  textAlign: "center",
};

const modalBtnStyle: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(0,0,0,0.03)",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
};

const css = `
  @media (hover: hover) and (pointer: fine) {
    a[aria-label*="でシェア"]:hover,
    button[aria-label*="コピー"]:hover,
    button[aria-label*="QR"]:hover {
      transform: translateY(-1px);
      opacity: 1;
    }
    a[aria-label*="でシェア"]:active,
    button[aria-label*="コピー"]:active,
    button[aria-label*="QR"]:active {
      transform: translateY(0px);
      opacity: 0.85;
    }
  }

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
