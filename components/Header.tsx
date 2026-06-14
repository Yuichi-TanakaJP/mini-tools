// components/Header.tsx
"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import ShareButtons from "@/components/ShareButtonsSuspended";
import NavDrawer from "@/components/NavDrawer";

type HeaderProps = {
  title?: string;
  subtitle?: string;
};

export default function Header({ title, subtitle }: HeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          backdropFilter: "blur(14px)",
          background: "rgba(8, 10, 18, 0.90)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            padding: "0 16px",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {/* 左: ハンバーガー + ロゴ */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* ハンバーガー（全ツール切り替え） */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="メニューを開く"
            aria-expanded={drawerOpen}
            style={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              marginLeft: -6,
              flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 9,
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.90)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* ロゴ */}
          <Link
            href="/"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "baseline",
              gap: 1,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.90)",
                fontWeight: 900,
                fontSize: 17,
                letterSpacing: -0.4,
              }}
            >
              mini-
            </span>
            <span
              style={{
                color: "#6ea8fe",
                fontWeight: 900,
                fontSize: 17,
                letterSpacing: -0.4,
              }}
            >
              tools
            </span>
          </Link>
          </div>

          {/* ページタイトル（ツールページ用） */}
          {(title || subtitle) && (
            <div
              style={{
                flex: 1,
                paddingLeft: 12,
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
              {title && subtitle && (
                <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
              )}
              {subtitle}
            </div>
          )}

          <ShareButtons
            text="mini-tools"
            methods={["premium", "qr"]}
            tone="light"
            inline
          />
        </div>

        {/* アクセントライン */}
        <div
          style={{
            height: 2,
            background:
              "linear-gradient(90deg, #2554ff 0%, #60a5fa 60%, transparent 100%)",
            opacity: 0.65,
          }}
        />
      </div>
    </header>

    <NavDrawer open={drawerOpen} onClose={closeDrawer} />
    </>
  );
}
