// components/Header.tsx
"use client";

import Link from "next/link";

type HeaderProps = {
  title?: string;
  subtitle?: string;
};

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(10px)",
        background: "rgba(16,16,16,0.85)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "#fff",
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: 0.2,
              lineHeight: 1.1,
            }}
          >
            mini-tools
          </Link>

          {(title || subtitle) && (
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.2,
              }}
            >
              {title ? <span>{title}</span> : null}
              {title && subtitle ? (
                <span style={{ margin: "0 6px", opacity: 0.6 }}>·</span>
              ) : null}
              {subtitle ? <span>{subtitle}</span> : null}
            </div>
          )}
        </div>

        {/* 右側は空でもOK（将来: ダーク/ライト切替やGitHubリンク等を置ける） */}
        <div />
      </div>
    </header>
  );
}
