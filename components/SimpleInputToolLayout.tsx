"use client";

import { useId, type ReactNode } from "react";
import ShareButtons from "@/components/ShareButtonsSuspended";
import MonetizeBar from "@/components/MonetizeBar";

type SimpleInputToolLayoutProps = {
  badge: ReactNode;
  title: string;
  description: string;
  inputPanel: ReactNode;
  resultPanel: ReactNode;
  shareText: string;
  footerNote?: ReactNode;
  maxWidth?: number;
  resultColumnWidth?: number;
  mobileBreakpoint?: number;
};

export default function SimpleInputToolLayout({
  badge,
  title,
  description,
  inputPanel,
  resultPanel,
  shareText,
  footerNote,
  maxWidth = 820,
  resultColumnWidth = 260,
  mobileBreakpoint = 600,
}: SimpleInputToolLayoutProps) {
  const layoutId = useId().replace(/:/g, "");
  const layoutClassName = `simple-input-layout-${layoutId}`;
  const resultClassName = `simple-input-result-${layoutId}`;

  return (
    <main style={{ maxWidth, margin: "0 auto", padding: "16px 16px 48px" }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--color-accent-sub)",
            color: "var(--color-accent)",
            fontSize: 11,
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          {badge}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.4 }}>
          {title}
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--color-text-sub)" }}>
          {description}
        </p>
      </div>

      <div className={layoutClassName}>
        <div>{inputPanel}</div>
        <div className={resultClassName}>{resultPanel}</div>
      </div>

      <div style={{ marginTop: 32 }}>
        <ShareButtons text={shareText} />
        <MonetizeBar />
      </div>

      {footerNote ? (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--color-text-muted)" }}>
          {footerNote}
        </div>
      ) : null}

      <style>{`
        .${layoutClassName} {
          display: grid;
          grid-template-columns: minmax(0, 1fr) ${resultColumnWidth}px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: ${mobileBreakpoint}px) {
          .${layoutClassName} {
            grid-template-columns: 1fr;
          }
          .${resultClassName} {
            order: -1;
          }
        }
      `}</style>
    </main>
  );
}
