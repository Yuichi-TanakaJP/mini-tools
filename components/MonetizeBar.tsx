// components/MonetizeBar.tsx
"use client";

import { track } from "@/lib/analytics";

export default function MonetizeBar() {
  const donateUrl = "https://ofuse.me/52617c2e"; // OFUSEのURL

  const onClick = () => {
    track("monetize_clicked", {
      service: "ofuse",
      position: "monetize_bar",
    });
  };

  return (
    <div style={styles.wrap}>
      <a
        href={donateUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        style={styles.link}
        aria-label="OFUSEで応援する"
        title="OFUSEで応援する"
      >
        <span style={styles.icon} aria-hidden="true">
          ☕
        </span>
        <span>役に立ったら、コーヒー1杯分の応援を</span>
      </a>

      <div style={styles.note}>
        ※ 外部サービス（OFUSE）での匿名支援・100円〜
      </div>

      <style>{css}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    textAlign: "center",
  },
  link: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "4px 0",
    textDecoration: "none",
    color: "rgba(0,0,0,0.80)",
    fontSize: 14,
    fontWeight: 600,
  },
  icon: {
    fontSize: 16,
    lineHeight: 1,
  },
  note: {
    fontSize: 11,
    opacity: 0.55,
  },
};

const css = `
  /* aタグ由来の枠・丸・フォーカスを無効化 */
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

  @media (hover: hover) and (pointer: fine) {
    a[aria-label="OFUSEで応援する"]:hover {
      opacity: 0.95;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    a[aria-label="OFUSEで応援する"]:active {
      opacity: 0.85;
    }
  }
`;
