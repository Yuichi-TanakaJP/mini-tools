// components/MonetizeBar.tsx
"use client";

import { track } from "@/lib/analytics";

export default function MonetizeBar() {
  const donateUrl = "https://ofuse.me/52617c2e"; // ← OFUSEの自分のURLに差し替え

  const onClick = () => {
    track("monetize_clicked", {
      service: "ofuse",
      position: "monetize_bar",
    });
  };

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 12,
        borderTop: "1px solid rgba(0,0,0,0.12)",
        textAlign: "center",
      }}
    >
      <a
        href={donateUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        style={{
          display: "inline-block",
          padding: "12px 16px",
          border: "1px solid rgba(0,0,0,0.8)",
          borderRadius: 12,
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        ☕ 役に立ったら、コーヒー1杯分の応援をもらえると嬉しいです
      </a>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        ※ 外部サービス（OFUSE）での匿名支援・100円〜
      </div>
    </div>
  );
}
