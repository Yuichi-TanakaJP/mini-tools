"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { QRCodeCanvas } from "qrcode.react";
import { createPortal } from "react-dom";
import styles from "./ShareButtons.module.css";

type ShareMethod = "x" | "facebook" | "email" | "copy" | "premium" | "qr";

type Props = {
  text?: string;
  url?: string;
  methods?: ShareMethod[];
  size?: number;
  iconsOnly?: boolean;
  label?: string;
  tone?: "default" | "light";
  inline?: boolean;
};

const DEFAULT_METHODS: ShareMethod[] = ["x", "facebook", "email", "copy"];

/**
 * pathname + searchParams から共有用の絶対 URL を生成する。
 * NEXT_PUBLIC_SITE_URL があればそれを base にし、なければ window.location.origin にフォールバックする。
 * url prop が渡された場合はそれをそのまま使う。
 */
function resolveShareUrl(
  urlProp: string | undefined,
  pathname: string,
  searchParams: URLSearchParams | null
): string {
  if (urlProp) return urlProp;

  const qs = searchParams?.toString();
  const pathWithQuery = `${pathname}${qs ? `?${qs}` : ""}`;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");

  try {
    return new URL(pathWithQuery, base).href;
  } catch {
    // base が取得できない SSR 初期レンダリング時は相対パスにフォールバック。
    // クライアント再レンダリング時には window.location.origin が base に入るため絶対 URL になる。
    return pathWithQuery;
  }
}

export default function ShareButtons({
  text,
  url,
  methods = DEFAULT_METHODS,
  size = 44,
  iconsOnly = true,
  label,
  tone = "default",
  inline = false,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [qrOpen, setQrOpen] = useState(false);

  const shareUrl = useMemo(
    () => resolveShareUrl(url, pathname, searchParams),
    [url, pathname, searchParams]
  );

  const shareLinks = useMemo(() => {
    const encUrl = encodeURIComponent(shareUrl);
    const encText = encodeURIComponent(text ?? "");

    return {
      x: `https://x.com/intent/tweet?text=${encText}&url=${encUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      email: `mailto:?subject=${encText}&body=${encUrl}`,
    };
  }, [shareUrl, text]);

  const onShare = (method: ShareMethod) => {
    track("share_clicked", { method });
  };

  const onCopy = async () => {
    onShare("copy");
    try {
      await navigator.clipboard.writeText(shareUrl);
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
      case "premium":
        return (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M3 19h18v2H3v-2zm0-3 3.5-8.5 4 4L12 4l1.5 7.5 4-4L21 16H3z"
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
      case "premium":
        return "Premium";
    }
  };

  const renderQrModal = () => {
    if (typeof document === "undefined") return null; // createPortal は SSR 環境では使えないためガード

    return createPortal(
      <div className={styles.overlay} onClick={() => setQrOpen(false)}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalLabel}>このページを共有</div>

          <div className={styles.modalQrWrapper}>
            <QRCodeCanvas value={shareUrl} size={180} />
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={() => onCopy()}
              className={styles.modalBtn}
            >
              URLコピー
            </button>
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className={styles.modalBtn}
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
    <div
      className={styles.root}
      style={
        {
          marginTop: inline ? 0 : 12,
          "--share-button-color":
            tone === "light" ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.78)",
          "--share-button-focus-ring":
            tone === "light"
              ? "0 0 0 3px rgba(110,168,254,0.45)"
              : "0 0 0 3px rgba(37,84,255,0.28)",
        } as React.CSSProperties
      }
    >
      {label ? <div className={styles.label}>{label}</div> : null}

      <div
        className={styles.buttonGroup}
        style={{ gap: inline ? 4 : 16 }}
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
                className={styles.iconButton}
                style={{ width: size, height: size }}
              >
                {renderIcon(m)}
                {!iconsOnly ? (
                  <span className={styles.labelText}>{labelFor(m)}</span>
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
                className={styles.iconButton}
                style={{ width: size, height: size }}
              >
                {renderIcon(m)}
                {!iconsOnly ? (
                  <span className={styles.labelText}>{labelFor(m)}</span>
                ) : null}
              </button>
            );
          }

          if (m === "premium") {
            return (
              <a
                key={m}
                href="/premium"
                onClick={() => onShare("premium")}
                aria-label="Premium へ移動"
                title="Premium へ移動"
                className={`${styles.iconButton} ${styles.iconButtonPremium}`}
                style={{ width: size, height: size }}
              >
                {renderIcon(m)}
                {!iconsOnly ? (
                  <span className={styles.labelText}>{labelFor(m)}</span>
                ) : null}
              </a>
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
              className={styles.iconButton}
              style={{ width: size, height: size }}
            >
              {renderIcon(m)}
              {!iconsOnly ? (
                <span className={styles.labelText}>{labelFor(m)}</span>
              ) : null}
            </a>
          );
        })}
      </div>

      {qrOpen && renderQrModal()}
    </div>
  );
}
