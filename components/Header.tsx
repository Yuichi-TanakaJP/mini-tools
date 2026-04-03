// components/Header.tsx
"use client";

import Link from "next/link";
import ShareButtons from "@/components/ShareButtonsSuspended";

type HeaderProps = {
  title?: string;
  subtitle?: string;
};

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
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
  );
}
