"use client";

import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          background: "var(--color-bg-card)",
          borderRadius: 24,
          border: "1px solid var(--color-border)",
          padding: "20px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#c2410c",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            市況グラフ
          </span>
          <span style={{ display: "block", margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
            {title}
          </span>
          {description ? (
            <span
              style={{
                display: "block",
                margin: "6px 0 0",
                color: "var(--color-text-muted)",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {description}
            </span>
          ) : null}
        </span>

        <span
          style={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 40,
            padding: "0 14px",
            borderRadius: 999,
            border: "1px solid var(--color-border)",
            background: open ? "#eff6ff" : "#fff",
            color: open ? "#1d4ed8" : "var(--color-text-sub)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {open ? "閉じる" : "グラフを表示"}
          <span aria-hidden style={{ transform: open ? "rotate(180deg)" : "none" }}>
            ▾
          </span>
        </span>
      </button>

      {open ? children : null}
    </div>
  );
}
