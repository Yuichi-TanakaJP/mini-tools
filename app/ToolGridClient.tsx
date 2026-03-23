// app/ToolGridClient.tsx
"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";

type ToolItem = {
  title: string;
  short: string;
  detail: string;
  href: string;
  icon: string;
  disabled?: boolean;
  statusLabel?: string;
};

type Props = {
  tools: ToolItem[];
  styles: Record<string, React.CSSProperties>;
};

export default function ToolGridClient({ tools, styles }: Props) {
  const onOpen = (href: string) => {
    track("tool_opened", { href });
  };

  return (
    <div style={styles.grid}>
      {tools.map((t) => (
        <div key={t.href} style={styles.cardLink} className="toolLink">
          {t.disabled ? (
            <div style={styles.card} className="toolCard">
              <div
                style={{
                  ...styles.cardInner,
                  opacity: 0.88,
                }}
                className="toolCardInner"
              >
                <div style={styles.cardTop}>
                  <div style={styles.icon}>{t.icon}</div>
                  <div
                    style={{
                      ...styles.arrow,
                      fontSize: 12,
                      width: 64,
                      fontWeight: 700,
                    }}
                    aria-hidden
                  >
                    {t.statusLabel ?? "準備中"}
                  </div>
                </div>

                <div style={styles.cardTitle}>{t.title}</div>
                <div style={styles.cardShort}>{t.short}</div>

                <div style={styles.hoverHint} className="hoverHint">
                  {t.statusLabel ?? "準備中"}
                </div>

                <details style={styles.details} className="toolDetails">
                  <summary style={styles.summary}>詳細を見る</summary>
                  <div style={styles.detailText}>{t.detail}</div>
                </details>

                <div className="tooltip" style={styles.tooltip}>
                  {t.detail}
                </div>
              </div>
            </div>
          ) : (
            <Link
              href={t.href}
              onClick={() => onOpen(t.href)}
              style={styles.cardLink}
              className="toolLink"
            >
              <div style={styles.card} className="toolCard">
                <div style={styles.cardInner} className="toolCardInner">
                  <div style={styles.cardTop}>
                    <div style={styles.icon}>{t.icon}</div>
                    <div style={styles.arrow} className="arrow" aria-hidden>
                      →
                    </div>
                  </div>

                  <div style={styles.cardTitle}>{t.title}</div>
                  <div style={styles.cardShort}>{t.short}</div>

                  <div style={styles.hoverHint} className="hoverHint">
                    詳細を見る
                  </div>

                  <details style={styles.details} className="toolDetails">
                    <summary style={styles.summary}>詳細を見る</summary>
                    <div style={styles.detailText}>{t.detail}</div>
                  </details>

                  <div className="tooltip" style={styles.tooltip}>
                    {t.detail}
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
